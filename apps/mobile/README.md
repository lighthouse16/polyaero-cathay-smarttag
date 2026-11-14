# Mobile API integration

The app uses the FastAPI backend for sign-in (password or email OTP), flight
search, booking creation, trip tabs, PNR import, and SmartTag preparation status.
Existing baggage/NFC bridge requests use the same API URL.

## Local API

From the repository root:

```powershell
Copy-Item apps\mobile\.env.example apps\mobile\.env
```

Edit `apps\mobile\.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:8000/api/v1
EXPO_PUBLIC_USE_MOCK_DATA=false
```

The full URL contains the IP/hostname, port, and `/api/v1` prefix. For a physical
phone, use your PC's LAN IP and connect both devices to the same network.
`10.0.2.2` is for the Android emulator only; `localhost` is for web or the iOS
simulator, not a physical phone.

Start the API on a reachable interface:

```powershell
Set-Location apps\api
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Allow this port through the Windows firewall on your private development
network. Open `http://YOUR_PC_LAN_IP:8000/health` on the phone to check reachability.
For Expo web, add its exact browser origin to the backend's `CORS_ORIGINS`.

After changing env values, restart Metro from the repository root:

```powershell
pnpm --filter @polyaero/mobile start --clear
```

The existing local `.env` is ignored by Git. Never put passwords, database
credentials, or server API keys in `EXPO_PUBLIC_*`: Expo bundles these values
into JavaScript.

## Production

Copy `apps\mobile\.env.production.example` to `apps\mobile\.env`, replace the
placeholder hostname with your deployed HTTPS API, and keep mock mode false.
For EAS builds, set these same public variables in the corresponding EAS
environment. Development/preview and production can use different addresses.
Do not rely on `NODE_ENV` to select a custom environment file.

API URLs are bundled at build/export time, not loaded remotely at runtime.
Rebuild the standalone APK after changing its API URL. A development client
using Metro only needs a Metro restart.

## Accounts and supported flows

- Use a real API member or a seeded demo member. Seeding with
  `SEED_USER_PASSWORD` enables password login; otherwise the API requests OTP.
  OTP delivery requires the backend email configuration. The app never
  invents or bypasses verification codes.
- Search uses an editable UTC date and airport codes. Select a returned flight
  and cabin, then enter a unique 5–10 character booking reference to create the
  backend reservation. Each booking represents one flight; return/multi-city
  itineraries can be added as separate flights. No payment or ticket issuance
  is implemented.
- My trips reads upcoming/past/cancelled bookings from the authenticated API,
  supports pull-to-refresh, and imports an existing reservation by PNR/surname.
- Tokens are held in memory and automatically refreshed after an expired
  access token. Closing/reloading the app requires signing in again. Logout
  clears local tokens and requests server revocation.

## Explicit prototype boundary

`EXPO_PUBLIC_USE_MOCK_DATA=true` restores the previous demo screens and
SmartTag simulator. The default is false: invalid credentials or failed API
requests never silently become demo success.

Signup, password reset, full live-booking NFC setup, and the other promotional
screens are not connected in this change. Live trips can query real SmartTag
preparation status but do not navigate into demo setup with fabricated IDs.
No Asia Miles balance or next-tier threshold is fabricated when the backend
does not supply those fields. The staff dashboard and database persistence of
its risk/recovery details are unchanged.

## Validation

From the repository root:

```powershell
pnpm --filter @polyaero/mobile typecheck
pnpm --filter @polyaero/shared exec vitest run --root ..\.. apps\mobile\src\services\__tests__ apps\mobile\src\services\nfc\__tests__
```

The real-API test skips by default. To run it, set `MOBILE_API_TEST_URL` to an
**isolated** FastAPI server's full API prefix and `MOBILE_API_TEST_PASSWORD` to
its seeded password; seed that server's database with today's UTC date first.
The test creates a reservation and must not target production.
