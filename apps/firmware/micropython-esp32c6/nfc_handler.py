# PN532 Type-4 Target (PICC) Emulation Handler
# APDU processing: SELECT, READ BINARY, UPDATE BINARY
# NDEF payload parsing for IATA pipe-delimited format

CC_FILE = bytearray([
    0x00, 0x0F, 0x20, 0x00, 0x3B, 0x00, 0x34,
    0x04, 0x06, 0xE1, 0x04, 0x00, 0xFF, 0x00, 0x00
])

# PN532 TgInitAsTarget parameters for Type-4A (ISO 14443-4)
TARGET_PARAMS = bytearray([
    0x00,  # Mode
    0x04, 0x00, 0x12, 0x34, 0x56,  # SENS_RES + NFCID1 (0x123456)
    0x20,  # SEL_RES
    0x01, 0xFE, 0x05, 0x01, 0x86,  # FeliCa params (dummy)
    0x04, 0x02, 0x02, 0x03, 0x00, 0x4B, 0x02, 0x4F, 0x49, 0x8A,  # NFCID2
    0x00, 0xFF, 0xFF,  # FeliCa pad
    0xAA, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11,  # Historical
    0x00, 0x00  # Length of general bytes
])

AID_NFC_FORUM = bytearray(b'\xD2\x76\x00\x00\x85\x01')  # NDEF Tag Application


class NfcTarget:
    def __init__(self, nfc):
        self.nfc = nfc
        self.ndef_file = bytearray(512)
        self.current_file = 0xE103
        self.write_completed = False
        self.wrote_payload = False
        self._init_ndef()

    def _init_ndef(self):
        """Pre-load NDEF buffer with valid 'INIT' Text record"""
        self.ndef_file[:] = b'\x00' * 512
        init_record = bytearray([0x00, 0x0B, 0xD1, 0x01, 0x07, 0x54, 0x02, 0x65, 0x6E, 0x49, 0x4E, 0x49, 0x54])
        self.ndef_file[0:len(init_record)] = init_record
        self.write_completed = False
        self.wrote_payload = False
        self.current_file = 0xE103

    def configure(self):
        """Send TgInitAsTarget to PN532"""
        self.nfc.call_function(0x8C, response_length=64, params=TARGET_PARAMS, timeout=5000)
        # Select NDEF Tag Application by default
        self.nfc.call_function(0x12, response_length=0, params=bytearray([0x34]), timeout=200)

    def reset(self):
        self._init_ndef()
        self.configure()

    def listen(self, session_ms: int = 5000) -> bytearray:
        """
        Listen for phone NFC write session.
        Returns NDEF file buffer if write completed, else None.
        """
        try:
            # Start target mode
            init_res = self.nfc.call_function(0x8C, response_length=64, params=TARGET_PARAMS, timeout=session_ms)
            if not init_res:
                return None

            print("\n[+] PHONE CONNECTED! Receiving IATA tag data...")

            # Process first command if present
            if len(init_res) > 1:
                first_cmd = init_res[1:]
                if len(first_cmd) >= 2 and first_cmd[0] in (0x00, 0x90):
                    self._process_apdu(first_cmd)

            # Continue receiving APDUs via TgGetData (0x86)
            for _ in range(40):
                req = self.nfc.call_function(0x86, response_length=128, timeout=600)
                if not req:
                    break
                status = req[0]
                if status != 0x00:
                    print(f"    -> Session ended (Status: 0x{status:02X})")
                    break
                if len(req) > 1:
                    self._process_apdu(req[1:])
                    if self.write_completed:
                        return self.ndef_file

            if self.wrote_payload:
                return self.ndef_file

        except Exception as e:
            print(f"    -> Communication error: {e}")
            self.nfc.reset()
            self.configure()

        return None

    def _process_apdu(self, apdu: bytearray):
        """Process incoming APDU command"""
        hex_str = " ".join([f"{b:02X}" for b in apdu])
        print(f"    -> APDU: {hex_str}")

        # 1. SELECT (00 A4 ...)
        if len(apdu) >= 2 and apdu[0] == 0x00 and apdu[1] == 0xA4:
            if apdu[2] == 0x04:  # Select by DF name (AID)
                if len(apdu) >= 12 and apdu[5:11] == AID_NFC_FORUM:
                    self.current_file = 0xE103  # CC file after AID select
                    self._respond_ok()
                else:
                    self._respond(0x6A, 0x82)  # File not found
            elif apdu[2] == 0x00 and len(apdu) >= 7:  # Select by File ID
                self.current_file = (apdu[5] << 8) | apdu[6]
                if self.current_file in (0xE103, 0xE104):
                    self._respond_ok()
                else:
                    self._respond(0x6A, 0x82)
            else:
                self._respond_ok()

        # 2. READ BINARY (00 B0 ...)
        elif len(apdu) >= 5 and apdu[0] == 0x00 and apdu[1] == 0xB0:
            offset = (apdu[2] << 8) | apdu[3]
            le = apdu[4]
            if self.current_file == 0xE103:
                data = CC_FILE[offset:offset + le]
            else:
                data = self.ndef_file[offset:offset + le]
            res = bytearray(data) + bytearray([0x90, 0x00])
            self._respond_raw(res)

        # 3. UPDATE BINARY (00 D6 ...) - supports multi-packet writes
        elif len(apdu) >= 5 and apdu[0] == 0x00 and apdu[1] == 0xD6:
            offset = (apdu[2] << 8) | apdu[3]
            lc = apdu[4]
            payload = apdu[5:5 + lc]

            # Bounds check
            if offset + lc <= len(self.ndef_file):
                self.ndef_file[offset:offset + lc] = payload

            self._respond_ok()

            # Track write completion
            if offset >= 2 or lc > 2:
                self.wrote_payload = True
            if offset == 0 and lc == 2:
                nlen = (payload[0] << 8) | payload[1]
                if nlen > 0 and self.wrote_payload:
                    self.write_completed = True
            elif offset == 0 and lc > 5:
                self.write_completed = True

        # 4. Proprietary class (e.g., DESFire 90 60) -> 6E 00 (Class not supported)
        elif apdu[0] != 0x00:
            self._respond(0x6E, 0x00)

        # 5. Unsupported instruction
        else:
            self._respond(0x6D, 0x00)

    def _respond_ok(self):
        self._respond(0x90, 0x00)

    def _respond(self, sw1: int, sw2: int):
        self.nfc.call_function(0x8E, response_length=1, params=bytearray([sw1, sw2]), timeout=300)

    def _respond_raw(self, data: bytearray):
        self.nfc.call_function(0x8E, response_length=1, params=data, timeout=300)


# =========================================================
# NDEF PAYLOAD PARSER
# =========================================================

def parse_iata_payload(ndef_buf: bytearray) -> dict:
    """
    Parse NDEF Text record containing IATA baggage data.
    Accepts:
    - Pipe-delimited: TAG|DEST|CITY|FLIGHT|DATE|TIME|PAX
    - Digits-only: extracts 10-digit tag number
    """
    nlen = (ndef_buf[0] << 8) | ndef_buf[1]
    search_end = min(len(ndef_buf), (2 + nlen) if nlen > 0 else 180)
    raw_bytes = ndef_buf[2:search_end]

    # Find Text record (TNF=0x01, Type='T')
    text_str = ""
    for idx in range(min(12, len(raw_bytes) - 3)):
        if raw_bytes[idx] == 0x54:  # 'T'
            plen = raw_bytes[idx - 1]
            lang_len = raw_bytes[idx + 1] & 0x3F
            start = idx + 2 + lang_len
            end = min(len(raw_bytes), idx + 1 + plen)
            text_str = "".join([chr(b) for b in raw_bytes[start:end] if 32 <= b <= 126])
            break

    if not text_str:
        # Fallback: all printable chars
        text_str = "".join([chr(b) for b in raw_bytes if 32 <= b <= 126])

    text_str = text_str.strip()
    if not text_str or text_str == "INIT":
        return None

    print(f"    -> Decoded NDEF Text: '{text_str}'")

    # Default IATA data structure
    result = {
        "tag_num": "0074774268",
        "dest_code": "JFK",
        "dest_city": "NEW YORK",
        "flight": "KL 1592",
        "date": "30SEP",
        "time": "1740",
        "passenger": "NGUYEN/DUC MANH"
    }

    if "|" in text_str:
        parts = [p.strip().upper() for p in text_str.split("|")]
        if len(parts) >= 1 and parts[0]:
            nums = "".join([c for c in parts[0] if '0' <= c <= '9'])
            if nums:
                result["tag_num"] = (nums + "0000000000")[:10]
        if len(parts) >= 2 and parts[1]:
            result["dest_code"] = parts[1][:3]
        if len(parts) >= 3 and parts[2]:
            result["dest_city"] = parts[2]
        if len(parts) >= 4 and parts[3]:
            result["flight"] = parts[3]
        if len(parts) >= 5 and parts[4]:
            result["date"] = parts[4]
        if len(parts) >= 6 and parts[5]:
            result["time"] = parts[5]
        if len(parts) >= 7 and parts[6]:
            result["passenger"] = parts[6]
        return result
    else:
        # Digits only - extract tag number
        nums = "".join([c for c in text_str if '0' <= c <= '9'])
        if len(nums) >= 6:
            result["tag_num"] = (nums + "0000000000")[:10]
            return result

    return None