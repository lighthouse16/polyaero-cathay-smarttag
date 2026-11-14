# PN532 Type-4 Target (PICC) Emulation Handler
# APDU processing: SELECT, READ BINARY, UPDATE BINARY
# NDEF payload parsing for IATA pipe-delimited format

import ujson as json
import errno
from config import NFC_APDU_TIMEOUT_MS

CC_FILE = bytearray([
    0x00, 0x0F, 0x20, 0x00, 0x3B, 0x00, 0x34,
    0x04, 0x06, 0xE1, 0x04, 0x02, 0x00, 0x00, 0x00
])

# PN532 TgInitAsTarget parameters for Type-4A (ISO 14443-4)
TARGET_PARAMS = bytearray([
    0x05,  # Passive ISO 14443-4 PICC only.
    0x04, 0x00, 0x12, 0x34, 0x56,  # SENS_RES + NFCID1 (0x123456)
    0x20,  # SEL_RES
    0x01, 0xFE, 0x05, 0x01, 0x86,  # FeliCa params (dummy)
    0x04, 0x02, 0x02, 0x03, 0x00, 0x4B, 0x02, 0x4F, 0x49, 0x8A,  # NFCID2
    0x00, 0xFF, 0xFF,  # FeliCa pad
    0xAA, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11,  # NFCID3t
    0x00, 0x00  # Lengths of general and historical bytes.
])

AID_NFC_FORUM = bytearray(b'\xD2\x76\x00\x00\x85\x01\x01')


class NfcTarget:
    def __init__(self, nfc, tag_uid="04:A2:3B:4C:5D:6E:70", refresh_display=None):
        self.nfc = nfc
        self.tag_uid = tag_uid.upper()
        self.refresh_display = refresh_display
        self.ndef_file = bytearray(512)
        self.current_file = 0xE103
        self.write_completed = False
        self.wrote_payload = False
        self._init_ndef()

    def _init_ndef(self, preserve_ndef: bool = False):
        """Pre-load NDEF buffer with valid 'INIT' Text record"""
        if not preserve_ndef:
            self.ndef_file[:] = b'\x00' * 512
            init_record = bytearray([0x00, 0x0B, 0xD1, 0x01, 0x07, 0x54, 0x02, 0x65, 0x6E, 0x49, 0x4E, 0x49, 0x54])
            self.ndef_file[0:len(init_record)] = init_record
        self.write_completed = False
        self.wrote_payload = False
        self.written = bytearray(512)
        self.refresh_attempted = False
        self.refresh_receipt = None
        self.current_file = 0xE103

    def configure(self):
        """Enable automatic ISO 14443-4 target responses before listening."""
        response = self.nfc.call_function(0x12, response_length=1, params=bytearray([0x34]))
        if response != bytearray():
            raise OSError(errno.EIO, "PN532 SetParameters failed")

    def reset(self):
        self._init_ndef()
        self.configure()

    def listen(self, session_ms: int = 5000) -> bytearray:
        """
        Listen for phone NFC write session.
        Returns NDEF file buffer if write completed, else None.
        """
        self._init_ndef(preserve_ndef=True)
        try:
            # Start target mode
            init_res = self.nfc.call_function(0x8C, response_length=64, params=TARGET_PARAMS, timeout=session_ms)
            if not init_res:
                return None

            print("\n[+] PHONE CONNECTED! Receiving IATA tag data...")

            # Process first command if present
            if len(init_res) > 1:
                first_cmd = init_res[1:]
                if len(first_cmd) >= 4 and first_cmd[0] in (0x00, 0x80, 0x90):
                    self._process_apdu(first_cmd)

            # Continue receiving APDUs via TgGetData (0x86)
            for _ in range(96):
                req = self.nfc.call_function(0x86, response_length=128, timeout=NFC_APDU_TIMEOUT_MS)
                if not req:
                    break
                status = req[0]
                if status != 0x00:
                    print(f"    -> Session ended (Status: 0x{status:02X})")
                    break
                if len(req) > 1:
                    self._process_apdu(req[1:])
                    if self.write_completed and not self.refresh_attempted:
                        self._refresh_display()

            if self.wrote_payload and not self.refresh_attempted:
                self._refresh_display()

            if self.write_completed or self.wrote_payload:
                return self.ndef_file

        except Exception as e:
            print(f"    -> Communication error: {e}")
        finally:
            # A host timeout does not cancel TgInitAsTarget/TgGetData on the chip.
            self.nfc.initialize()
            self.configure()

        return None

    def _refresh_display(self):
        self.refresh_attempted = True
        try:
            if ((self.ndef_file[0] << 8) | self.ndef_file[1]) == 0 and self.wrote_payload:
                if (self.ndef_file[2] & 0x10) and self.ndef_file[3] == 1:
                    inferred = 4 + self.ndef_file[4]
                    self.ndef_file[0] = (inferred >> 8) & 0xFF
                    self.ndef_file[1] = inferred & 0xFF
            parsed = parse_iata_payload(self.ndef_file)
            if not parsed or self.refresh_display is None:
                return
            sync_id = parsed.get("sync_id")
            if sync_id and parsed.get("tag_code") != self.tag_uid:
                return
            self.refresh_display(parsed)
            self.refresh_receipt = sync_id
        except Exception as exc:
            print(f"[EPD] Refresh failed: {exc}")

    def _process_apdu(self, apdu: bytearray):
        """Process incoming APDU command"""
        hex_str = " ".join([f"{b:02X}" for b in apdu])
        print(f"    -> APDU: {hex_str}")
        if len(apdu) < 4:
            self._respond(0x67, 0x00)
            return

        # PA1 bridge identity and refresh receipt, not an RF-UID ownership proof.
        if apdu == bytearray([0x80, 0x10, 0x00, 0x00, 0x00]):
            self._respond_raw(bytearray(("PA1|" + self.tag_uid).encode()) + bytearray([0x90, 0x00]))
            return
        if apdu == bytearray([0x80, 0x11, 0x00, 0x00, 0x00]):
            if self.refresh_receipt:
                self._respond_raw(bytearray(("PA1|" + self.refresh_receipt).encode()) + bytearray([0x90, 0x00]))
            else:
                self._respond(0x65, 0x81)
            return

        # 1. SELECT (00 A4 ...)
        if len(apdu) >= 5 and apdu[0] == 0x00 and apdu[1] == 0xA4:
            if apdu[2] == 0x04:  # Select by DF name (AID)
                if apdu[4] == len(AID_NFC_FORUM) and apdu[5:11] == AID_NFC_FORUM[:6] and apdu[11] in (0x00, 0x01):
                    self.current_file = 0xE103  # CC file after AID select
                    self._respond_ok()
                else:
                    self._respond(0x6A, 0x82)  # File not found
            elif apdu[2] == 0x00 and len(apdu) >= 7:  # Select by File ID
                file_id = (apdu[5] << 8) | apdu[6]
                if apdu[4] == 2 and file_id in (0xE103, 0xE104):
                    self.current_file = file_id
                    self._respond_ok()
                else:
                    self._respond(0x6A, 0x82)
            else:
                self._respond_ok()

        # 2. READ BINARY (00 B0 ...)
        elif len(apdu) >= 5 and apdu[0] == 0x00 and apdu[1] == 0xB0:
            offset = (apdu[2] << 8) | apdu[3]
            le = apdu[4] or 256
            source = CC_FILE if self.current_file == 0xE103 else self.ndef_file
            if offset + le > len(source):
                self._respond(0x6B, 0x00)
                return
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

            if self.current_file != 0xE104 or not lc or len(apdu) != 5 + lc or offset + lc > len(self.ndef_file):
                self._respond(0x67, 0x00)
                return
            if offset == 0:
                if lc < 2:
                    self._respond(0x67, 0x00)
                    return
                nlen = (payload[0] << 8) | payload[1]
                if nlen > 510:
                    self._respond(0x67, 0x00)
                    return
                if nlen == 0 or lc > 2:
                    self.written[:] = b'\x00' * 512
                    self.write_completed = False
                    self.wrote_payload = False
                    self.refresh_attempted = False
                    self.refresh_receipt = None
                if nlen and lc == 2 and not all(self.written[2:2 + nlen]):
                    self._respond(0x67, 0x00)
                    return
            self.ndef_file[offset:offset + lc] = payload
            self.written[offset:offset + lc] = b'\x01' * lc
            if offset >= 2 or lc > 2:
                self.wrote_payload = True
            nlen = (self.ndef_file[0] << 8) | self.ndef_file[1]
            if nlen and self.wrote_payload and all(self.written[0:2 + nlen]):
                self.write_completed = True
            self._respond_ok()
            if self.write_completed and not self.refresh_attempted:
                self._refresh_display()

        # 4. Proprietary class (e.g., DESFire 90 60) -> 6E 00 (Class not supported)
        elif apdu[0] != 0x00:
            self._respond(0x6E, 0x00)

        # 5. Unsupported instruction
        else:
            self._respond(0x6D, 0x00)

    def _respond_ok(self):
        self._respond(0x90, 0x00)

    def _respond(self, sw1: int, sw2: int):
        self._respond_raw(bytearray([sw1, sw2]))

    def _respond_raw(self, data: bytearray):
        response = self.nfc.call_function(0x8E, response_length=1, params=data)
        if response != bytearray([0]):
            raise OSError(errno.EIO, "PN532 TgSetData failed: {}".format(response))


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
    if len(ndef_buf) < 9:
        return None
    nlen = (ndef_buf[0] << 8) | ndef_buf[1]
    if not nlen or nlen > len(ndef_buf) - 2:
        return None
    raw = ndef_buf[2:2 + nlen]
    if len(raw) < 3 or (raw[0] & 0x20):
        return None

    text_str = None
    if (raw[0] & 0xEF) == 0xC1 and raw[1] == 1:
        short = bool(raw[0] & 0x10)
        header_len = 3 if short else 6
        if len(raw) < header_len + 4:
            return None
        plen = raw[2] if short else int.from_bytes(raw[2:6], "big")
        if raw[header_len] != 0x54:
            return None
        status = raw[header_len + 1]
        lang_len = status & 0x3F
        start = header_len + 2 + lang_len
        end = header_len + 1 + plen
        if status & 0x80 or plen < 1 + lang_len or end > len(raw):
            return None
        try:
            text_str = bytes(raw[start:end]).decode("utf-8").strip()
        except UnicodeError:
            return None
    else:
        for idx in range(1, min(64, len(raw) - 3)):
            if raw[idx] == 0x54:
                plen = raw[idx - 1]
                lang_len = raw[idx + 1] & 0x3F
                start = idx + 2 + lang_len
                end = idx + 1 + plen
                if plen >= 1 + lang_len and end <= len(raw):
                    try:
                        text_str = bytes(raw[start:end]).decode("utf-8").strip()
                        break
                    except UnicodeError:
                        return None
        if text_str is None:
            return None

    if not text_str or text_str == "INIT":
        return None
    print(f"    -> Decoded NDEF Text: '{text_str}'")

    if text_str.startswith("{") or text_str.startswith("["):
        try:
            record = json.loads(text_str)
            if not isinstance(record, dict):
                return None
            tag = record.get("tag", "")
            route = record.get("route", "").split("-")
            flight = record.get("flight", "")
            sync_id = record.get("sync_id")
            if (not isinstance(tag, str) or len(tag) != 10 or not tag.isdigit()
                    or len(route) != 2 or any(len(code) != 3 or not code.isalpha() for code in route)
                    or not isinstance(flight, str) or not flight.strip()
                    or (sync_id is not None and (not isinstance(sync_id, str)
                        or not 1 <= len(sync_id) <= 64
                        or any(ord(c) < 33 or ord(c) > 126 for c in sync_id)))):
                return None
            date = str(record.get("date", ""))
            if len(date) == 10 and date[4] == "-" and date[7] == "-":
                month = int(date[5:7])
                if not 1 <= month <= 12:
                    return None
                date = date[8:10] + ("JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                                     "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")[month - 1]
            return {
                "tag_num": tag,
                "dest_code": route[1].upper(),
                "dest_city": route[1].upper(),
                "flight": flight.upper(),
                "date": date,
                "time": str(record.get("time", "")),
                "passenger": str(record.get("passenger", "")).upper(),
                "tag_code": str(record.get("tag_code", "")).upper(),
                "sync_id": sync_id,
            }
        except (ValueError, TypeError, AttributeError):
            return None

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
        cleaned = text_str.strip().upper()
        if len(cleaned) == 3 and cleaned.isalpha():
            result["dest_code"] = cleaned
            result["dest_city"] = cleaned
            return result
        if cleaned:
            result["passenger"] = cleaned[:23]
            return result

    return None