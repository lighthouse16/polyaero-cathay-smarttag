#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>  // Install "ArduinoJson" (v7+) via Arduino IDE Library Manager

// ============================================================================
// 1. WIFI & POLYAERO FASTAPI SERVER CONFIGURATION
// ============================================================================
const char* WIFI_SSID     = "YOUR_WIFI_OR_HOTSPOT_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Paulin's MacBook FastAPI endpoint (update IP if switching to a phone hotspot)
const char* TAG_UID       = "04:A2:3B:4C:5D:6E:70";
const char* API_BASE_URL  = "http://10.11.72.211:8000/api/v1";

// Poll every 3 seconds; only refresh the E-Ink screen when data actually changes
const unsigned long POLL_INTERVAL_MS = 3000;
unsigned long lastPollMs = 0;
String lastRenderedSignature = "";

// ============================================================================
// 2. HARDWARE HOOK: MATTHEW'S WAVESHARE 4.2" E-PAPER DRAWING ROUTINE
// ============================================================================
// Include your Waveshare 4.2" E-Paper / GxEPD2 headers & pin definitions above.
void initEinkHardware() {
  // TODO (Matthew): Paste your E-Paper SPI & display.init() setup here
  Serial.println("[E-INK] Hardware initialized (ready for Waveshare 4.2\" SPI calls)");
}

void renderEinkDisplay(
  const char* flight,
  const char* origin,
  const char* destination,
  const char* bagNumber,
  const char* passenger,
  const char* cabin,
  float weightKg,
  const char* banner,
  bool isRush
) {
  Serial.println("==========================================");
  Serial.printf("  CATHAY PACIFIC SMARTTAG (%s)\n", TAG_UID);
  Serial.printf("  FLIGHT: %s   ROUTE: %s -> %s\n", flight, origin, destination);
  Serial.printf("  PAX:    %s (%s)\n", passenger, cabin);
  Serial.printf("  TAG:    %s   WT: %.1f KG\n", bagNumber, weightKg);
  Serial.printf("  BANNER: [%s]  RUSH: %s\n", banner, isRush ? "YES (RED)" : "NO");
  Serial.println("==========================================");

  // TODO (Matthew): Paste your Waveshare 4.2" E-Paper drawing code here:
  // - Draw header: "CATHAY PACIFIC" + TAG_UID
  // - Draw large flight & destination IATA code (flight, destination)
  // - Draw passenger name, cabin class, and weightKg
  // - Draw Code 128 / Interleaved 2-of-5 barcode for bagNumber
  // - Draw status banner (use RED accent on 3-color E-Paper if isRush == true)
  // - Trigger display.display() / EPD_4IN2_Display()
}

// ============================================================================
// 3. OPTIONAL: REPORT PHYSICAL NFC TAP BACK TO CLOUD
// ============================================================================
void notifyNfcTapToBackend(const char* scannerRole) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/tags/" + String(TAG_UID) + "/tap";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String body = String("{\"scanner_role\":\"") + scannerRole + "\",\"location_code\":\"HKG-STAGE-DEMO\"}";
  int code = http.POST(body);
  Serial.printf("[NFC TAP] POST %s -> HTTP %d\n", url.c_str(), code);
  http.end();
}

// ============================================================================
// 4. WIFI & POLLING LOOP
// ============================================================================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WIFI] Connected! ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
}

void pollSmartTagState() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + "/tags/" + String(TAG_UID) + "/display";
  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err) {
      const char* flight      = doc["flight"]      | "CX888";
      const char* origin      = doc["origin"]      | "HKG";
      const char* destination = doc["destination"] | "YVR";
      const char* bagNumber   = doc["bag_number"]  | "0160892012";
      const char* passenger   = doc["passenger"]   | "CHAN/TIMOTHY";
      const char* cabin       = doc["cabin"]       | "PRIORITY J";
      float weightKg          = doc["weight_kg"]   | 22.4;
      const char* banner      = doc["banner"]      | "ON TRACK";
      bool isRush             = doc["is_rush"]     | false;

      // Build state signature so we don't flicker the E-Ink screen unnecessarily
      String signature = String(flight) + "|" + String(destination) + "|" + String(banner) + "|" + String(isRush);
      if (signature != lastRenderedSignature) {
        lastRenderedSignature = signature;
        renderEinkDisplay(flight, origin, destination, bagNumber, passenger, cabin, weightKg, banner, isRush);
      }
    } else {
      Serial.printf("[JSON] Parse error: %s\n", err.c_str());
    }
  } else {
    Serial.printf("[HTTP] GET %s failed (code %d)\n", url.c_str(), httpCode);
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  initEinkHardware();
  connectWiFi();
  pollSmartTagState();  // Immediate initial sync on boot
}

void loop() {
  unsigned long now = millis();
  if (now - lastPollMs >= POLL_INTERVAL_MS) {
    lastPollMs = now;
    pollSmartTagState();
  }
}
