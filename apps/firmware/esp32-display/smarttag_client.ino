// PolyAero Cathay SmartTag - ESP32-S3 + PN532 (target mode) + 4.2" E-Paper
//
// Flow:
//   1. Phone Web NFC writes the JSON NDEF record from POST /smarttag/sync/payload.
//   2. PN532 emulates a Type-4 tag and hands the record to this sketch.
//   3. Sketch POSTs it to /tags/{TAG_UID}/tap, then renders the returned display.
//   4. Sketch polls /tags/{TAG_UID}/display so app-side changes reach the screen.
//
// Libraries: ArduinoJson, GxEPD2. PN532 framing is done directly over UART1.

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <GxEPD2_BW.h>

// ============================================================================
// 1. CONFIG - update these for your network and wiring
// ============================================================================
const char* WIFI_SSID = "YOUR_WIFI_OR_HOTSPOT_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* API_BASE_URL = "http://10.11.72.211:8000/api/v1";
const char* TAG_UID = "04:A2:3B:4C:5D:6E:70";
const char* DEVICE_KEY = "";  // IOT_DEVICE_KEY on the API; empty disables the check

// PN532 HAT on UART1. These are ESP32-classic pins; on an ESP32-S3 GPIO22 does
// not exist, so move RX to a free GPIO if you are using an S3 board.
#define PN532_RX 22
#define PN532_TX 23
#define PN532_RST 7
#define PN532_BAUD 115200

// 4.2" e-paper SPI (ESP32-S3 defaults; replace with your module's pin map)
#define EPD_CS 10
#define EPD_DC 8
#define EPD_RST 9
#define EPD_BUSY 13
#define EPD_SCK 12
#define EPD_MOSI 11

GxEPD2_BW<GxEPD2_420, GxEPD2_420::HEIGHT> display(
    GxEPD2_420(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY));

const unsigned long POLL_INTERVAL_MS = 3000;
const unsigned long NFC_SESSION_MS = 5000;
unsigned long lastPollMs = 0;
String lastRenderedSignature = "";

// ============================================================================
// 2. PN532 FRAME LAYER
// ============================================================================
const uint8_t PN532_ACK[6] = {0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00};

const uint8_t TARGET_PARAMS[] = {
    0x00, 0x04, 0x00, 0x12, 0x34, 0x56, 0x20, 0x01, 0xFE, 0x05, 0x01, 0x86,
    0x04, 0x02, 0x02, 0x03, 0x00, 0x4B, 0x02, 0x4F, 0x49, 0x8A, 0x00, 0xFF,
    0xFF, 0xAA, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00,
    0x00};

void pn532Reset() {
  pinMode(PN532_RST, OUTPUT);
  digitalWrite(PN532_RST, HIGH);
  delay(10);
  digitalWrite(PN532_RST, LOW);
  delay(400);
  digitalWrite(PN532_RST, HIGH);
  delay(100);
}

int readByte(unsigned long timeout) {
  unsigned long start = millis();
  while (millis() - start < timeout) {
    if (Serial1.available()) return Serial1.read();
    delay(1);
  }
  return -1;
}

bool waitAck(unsigned long timeout) {
  uint8_t matched = 0;
  unsigned long start = millis();
  while (millis() - start < timeout) {
    int value = readByte(10);
    if (value < 0) continue;
    if ((uint8_t)value == PN532_ACK[matched]) {
      if (++matched == sizeof(PN532_ACK)) return true;
    } else {
      matched = ((uint8_t)value == PN532_ACK[0]) ? 1 : 0;
    }
  }
  return false;
}

bool sendCommand(const uint8_t* cmd, uint8_t cmdLen) {
  uint8_t frame[192];
  uint8_t len = cmdLen + 1;  // TFI + command bytes
  frame[0] = 0x00;
  frame[1] = 0x00;
  frame[2] = 0xFF;
  frame[3] = len;
  frame[4] = (uint8_t)(~len + 1);
  frame[5] = 0xD4;
  memcpy(frame + 6, cmd, cmdLen);
  uint8_t sum = 0xD4;
  for (uint8_t i = 0; i < cmdLen; i++) sum += cmd[i];
  frame[6 + cmdLen] = (uint8_t)(~sum + 1);
  frame[7 + cmdLen] = 0x00;

  while (Serial1.available()) Serial1.read();
  Serial1.write(frame, 8 + cmdLen);
  Serial1.flush();
  return waitAck(1000);
}

int readFrame(uint8_t* out, uint8_t maxLen, unsigned long timeout) {
  uint8_t matched = 0;
  unsigned long start = millis();
  while (millis() - start < timeout) {
    int value = readByte(timeout);
    if (value < 0) return -1;
    if ((uint8_t)value == PN532_ACK[matched]) {
      if (++matched == 3) break;  // 00 00 FF
    } else {
      matched = ((uint8_t)value == 0x00) ? 1 : 0;
    }
  }

  int len = readByte(500);
  int lcs = readByte(500);
  if (len < 0 || lcs < 0 || ((len + lcs) & 0xFF) != 0x00) return -1;
  if (len == 0) {
    readByte(500);  // DCS
    readByte(500);  // postamble
    return 0;
  }

  uint8_t data[160];
  if (len > (int)sizeof(data) || len > maxLen + 2) return -1;
  uint8_t sum = 0;
  for (int i = 0; i < len; i++) {
    int value = readByte(500);
    if (value < 0) return -1;
    data[i] = (uint8_t)value;
    sum += data[i];
  }
  readByte(500);  // DCS
  readByte(500);  // postamble

  if (len < 2 || data[0] != 0xD5) return -1;
  uint8_t payloadLen = len - 2;
  memcpy(out, data + 2, payloadLen);
  return payloadLen;
}

bool pn532Call(const uint8_t* cmd, uint8_t cmdLen, uint8_t* resp, uint8_t* respLen,
               unsigned long timeout) {
  if (!sendCommand(cmd, cmdLen)) return false;
  int len = readFrame(resp, 128, timeout);
  if (len < 0) return false;
  *respLen = (uint8_t)len;
  return true;
}

// ============================================================================
// 3. TYPE-4 NDEF EMULATION
// ============================================================================
const uint8_t CC_FILE[] = {0x00, 0x0F, 0x20, 0x00, 0x3B, 0x00, 0x34,
                           0x04, 0x06, 0xE1, 0x04, 0x00, 0xFF, 0x00, 0x00};
uint8_t ndefFile[512];
uint16_t currentFile = 0xE103;
bool wrotePayload = false;
bool writeCompleted = false;

void setInitialNdef() {
  memset(ndefFile, 0, sizeof(ndefFile));
  currentFile = 0xE103;
  const uint8_t initRecord[] = {0x00, 0x0B, 0xD1, 0x01, 0x07, 0x54,
                                0x02, 0x65, 0x6E, 0x49, 0x4E, 0x49, 0x54};
  memcpy(ndefFile, initRecord, sizeof(initRecord));
}

void tgSetData(const uint8_t* data, uint8_t len) {
  uint8_t cmd[132];
  cmd[0] = 0x8E;
  memcpy(cmd + 1, data, len);
  uint8_t resp[8];
  uint8_t respLen = 0;
  pn532Call(cmd, len + 1, resp, &respLen, 300);
}

void processApdu(const uint8_t* apdu, uint8_t len) {
  if (len >= 2 && apdu[0] == 0x00 && apdu[1] == 0xA4) {
    if (len >= 7 && apdu[2] == 0x00) {
      currentFile = (apdu[5] << 8) | apdu[6];
    } else if (len >= 12 && apdu[2] == 0x04) {
      currentFile = 0xE103;
    }
    uint8_t ok[] = {0x90, 0x00};
    tgSetData(ok, sizeof(ok));
  } else if (len >= 5 && apdu[0] == 0x00 && apdu[1] == 0xB0) {
    uint16_t offset = (apdu[2] << 8) | apdu[3];
    uint8_t le = apdu[4];
    const uint8_t* src = currentFile == 0xE103 ? CC_FILE : ndefFile;
    uint16_t srcLen = currentFile == 0xE103 ? sizeof(CC_FILE) : sizeof(ndefFile);
    uint8_t out[132];
    uint8_t count = 0;
    for (uint8_t i = 0; i < le && i < 128; i++) {
      out[count++] = (offset + i < srcLen) ? src[offset + i] : 0x00;
    }
    out[count++] = 0x90;
    out[count++] = 0x00;
    tgSetData(out, count);
  } else if (len >= 5 && apdu[0] == 0x00 && apdu[1] == 0xD6) {
    uint16_t offset = (apdu[2] << 8) | apdu[3];
    uint8_t lc = apdu[4];
    if (offset + lc <= sizeof(ndefFile)) {
      memcpy(ndefFile + offset, apdu + 5, lc);
      if (offset >= 2 || lc > 2) wrotePayload = true;
      if (offset == 0 && lc == 2 &&
          (((ndefFile[0] << 8) | ndefFile[1]) > 0) && wrotePayload) {
        writeCompleted = true;
      } else if (offset == 0 && lc > 5) {
        writeCompleted = true;
      }
    }
    uint8_t ok[] = {0x90, 0x00};
    tgSetData(ok, sizeof(ok));
  } else {
    uint8_t rejected[] = {0x6D, 0x00};
    tgSetData(rejected, sizeof(rejected));
  }
}

String extractNdefText() {
  int nlen = (ndefFile[0] << 8) | ndefFile[1];
  int end = min((int)sizeof(ndefFile), nlen > 0 ? 2 + nlen : 180);
  String text;
  for (int i = 2; i < end; i++) {
    char c = (char)ndefFile[i];
    if (c >= 32 && c < 127) text += c;
  }
  return text;
}

bool parsePa1(const String& s, String& bagId, String& status) {
  int p1 = s.indexOf('|');
  if (p1 < 0) return false;
  String prefix = s.substring(0, p1);
  if (prefix != "PA1") return false;
  int p2 = s.indexOf('|', p1 + 1);
  int p3 = s.indexOf('|', p2 + 1);
  int p4 = s.indexOf('|', p3 + 1);
  if (p2 < 0 || p3 < 0 || p4 < 0) return false;
  bagId = s.substring(p1 + 1, p2);
  String route = s.substring(p2 + 1, p3);
  status = s.substring(p3 + 1, p4);
  return bagId.length() > 0 && status.length() > 0;
}

bool listenForNdef(String& payload) {
  uint8_t cmd[40];
  cmd[0] = 0x8C;
  memcpy(cmd + 1, TARGET_PARAMS, sizeof(TARGET_PARAMS));
  uint8_t resp[128];
  uint8_t respLen = 0;
  wrotePayload = false;
  writeCompleted = false;

  if (!pn532Call(cmd, sizeof(TARGET_PARAMS) + 1, resp, &respLen, 2000)) return false;
  if (respLen > 1 && resp[0] == 0x00) processApdu(resp + 1, respLen - 1);

  unsigned long start = millis();
  while (millis() - start < NFC_SESSION_MS && !writeCompleted) {
    uint8_t getData = 0x86;
    if (!pn532Call(&getData, 1, resp, &respLen, 600)) break;
    if (respLen < 1 || resp[0] != 0x00) break;
    if (respLen > 1) processApdu(resp + 1, respLen - 1);
  }

  if (!wrotePayload) return false;
  payload = extractNdefText();
  return payload.length() > 0;
}

void configurePn532() {
  uint8_t cmd[] = {0x12, 0x34};
  uint8_t resp[8];
  uint8_t respLen = 0;
  pn532Call(cmd, sizeof(cmd), resp, &respLen, 300);
}

// ============================================================================
// 4. BACKEND + RENDERING
// ============================================================================
void renderDisplay(JsonObject data) {
  const char* flight = data["flight"] | "--";
  const char* origin = data["origin"] | "HKG";
  const char* destination = data["destination"] | "---";
  const char* bagNumber = data["bag_number"] | "";
  const char* passenger = data["passenger"] | "PASSENGER";
  const char* cabin = data["cabin"] | "";
  const char* banner = data["banner"] | "AWAITING SYNC";
  float weightKg = data["weight_kg"] | 0.0;
  bool rush = data["is_rush"] | false;

  String signature = String(flight) + "|" + destination + "|" + banner + "|" +
                     bagNumber + "|" + (rush ? "1" : "0");
  if (signature == lastRenderedSignature) return;
  lastRenderedSignature = signature;

  display.setFullWindow();
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.setTextColor(GxEPD_BLACK);
    display.setCursor(6, 4);
    display.setTextSize(1);
    display.print("CATHAY PACIFIC  SMARTTAG");
    display.drawLine(0, 18, display.width(), 18, GxEPD_BLACK);

    display.setTextSize(4);
    display.setCursor(6, 30);
    display.print(flight);
    display.setTextSize(3);
    String dest = destination;
    display.setCursor(display.width() - dest.length() * 18 - 6, 38);
    display.print(dest);

    display.setTextSize(2);
    display.setCursor(6, 84);
    display.print(passenger);
    display.setCursor(6, 110);
    display.print(origin);
    display.print(" -> ");
    display.print(destination);

    display.setTextSize(1);
    display.setCursor(6, 142);
    display.print("CABIN ");
    display.print(cabin);
    display.setCursor(6, 156);
    display.print("WT ");
    display.print(weightKg, 1);
    display.print(" KG   BAG ");
    display.print(bagNumber);

    // ITF-10 barcode for the IATA licence plate.
    if (strlen(bagNumber) == 10) {
      const uint8_t patterns[10][5] = {{0, 0, 1, 1, 0}, {1, 0, 0, 0, 1},
                                       {0, 1, 0, 0, 1}, {1, 1, 0, 0, 0},
                                       {0, 0, 1, 0, 1}, {1, 0, 1, 0, 0},
                                       {0, 1, 1, 0, 0}, {0, 0, 0, 1, 1},
                                       {1, 0, 0, 1, 0}, {0, 1, 0, 1, 0}};
      int x = 20;
      int y = 190;
      for (int pair = 0; pair < 5; pair++) {
        int a = bagNumber[pair * 2] - '0';
        int b = bagNumber[pair * 2 + 1] - '0';
        for (int i = 0; i < 5; i++) {
          int width = (patterns[a][i] ? 2 : 1) + (patterns[b][i] ? 2 : 1);
          display.fillRect(x, y, width, 70, GxEPD_BLACK);
          x += width + 2;
        }
      }
    }

    int bannerTop = display.height() - 78;
    if (rush) {
      display.fillRect(0, bannerTop, display.width(), 78, GxEPD_BLACK);
      display.setTextColor(GxEPD_WHITE);
    } else {
      display.drawRect(0, bannerTop, display.width(), 78, GxEPD_BLACK);
      display.setTextColor(GxEPD_BLACK);
    }
    display.setTextSize(2);
    display.setCursor(8, bannerTop + 14);
    if (rush) display.print("! ");
    display.print(banner);
    display.setTextSize(1);
    display.setCursor(8, bannerTop + 52);
    display.print("SMARTTAG / ");
    display.print(TAG_UID);
  } while (display.nextPage());
}

void syncTap(const String& ndefPayload) {
  HTTPClient http;

  String bagId, status, url;
  bool isJson = ndefPayload.length() > 0 && ndefPayload[0] == '{';

  if (isJson) {
    url = String(API_BASE_URL) + "/tags/" + String(TAG_UID) + "/tap";
    Serial.println("[NFC] JSON payload");
  } else if (parsePa1(ndefPayload, bagId, status)) {
    url = String(API_BASE_URL) + "/tags/" + bagId + "/tap";
    Serial.printf("[NFC] PA1 bagId=%s status=%s\n", bagId.c_str(), status.c_str());
  } else {
    Serial.println("[NFC] Unknown payload format");
    return;
  }

  http.begin(url);
  http.setTimeout(4000);
  http.addHeader("Content-Type", "application/json");
  if (strlen(DEVICE_KEY) > 0) http.addHeader("X-Device-Key", DEVICE_KEY);

  JsonDocument request;
  if (isJson) {
    request["ndef_payload"] = ndefPayload;
  } else {
    request["next_status"] = status;
  }
  request["reader_id"] = "ESP32-PN532-01";
  request["location_code"] = "HKG-STAGE-DEMO";
  String body;
  serializeJson(request, body);

  int code = http.POST(body);
  if (code == HTTP_CODE_OK) {
    JsonDocument response;
    if (!deserializeJson(response, http.getString())) {
      renderDisplay(response["display"].as<JsonObject>());
    }
  } else {
    Serial.printf("[TAP] POST %s -> HTTP %d\n", url.c_str(), code);
  }
  http.end();
}

void pollDisplay() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(API_BASE_URL) + "/tags/" + String(TAG_UID) + "/display";
  http.begin(url);
  http.setTimeout(3000);
  int code = http.GET();
  if (code == HTTP_CODE_OK) {
    JsonDocument response;
    if (!deserializeJson(response, http.getString())) {
      renderDisplay(response.as<JsonObject>());
    }
  } else {
    Serial.printf("[DISPLAY] GET %s -> HTTP %d\n", url.c_str(), code);
  }
  http.end();
}

// ============================================================================
// 5. SETUP + LOOP
// ============================================================================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WIFI] %s\n",
                WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str()
                                              : "offline");
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial1.begin(PN532_BAUD, SERIAL_8N1, PN532_RX, PN532_TX);

  SPI.begin(EPD_SCK, -1, EPD_MOSI, EPD_CS);
  display.init(115200);
  display.setRotation(1);  // portrait 300x400
  display.setTextColor(GxEPD_BLACK);

  pn532Reset();
  configurePn532();
  setInitialNdef();

  connectWiFi();
  pollDisplay();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  String payload;
  if (listenForNdef(payload)) {
    Serial.println("[NFC] NDEF received: " + payload);
    syncTap(payload);
  }

  if (millis() - lastPollMs >= POLL_INTERVAL_MS) {
    lastPollMs = millis();
    pollDisplay();
  }
  delay(20);
}
