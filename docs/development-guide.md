# Development guide

The [root README](../README.md#run-locally) is the canonical local quickstart:
prerequisites, PostgreSQL setup, migrations/seeds, environment files, and
commands for all three development servers.

## Application environments

| Application     | Copy from                  | Local file              | Public API variable             |
| --------------- | -------------------------- | ----------------------- | ------------------------------- |
| Passenger app   | `apps\mobile\.env.example` | `apps\mobile\.env`      | `EXPO_PUBLIC_API_URL`           |
| Staff dashboard | `apps\staff\.env.example`  | `apps\staff\.env.local` | `NEXT_PUBLIC_API_URL`           |
| Backend         | `apps\api\.env.example`    | `apps\api\.env`         | None; server configuration only |

The root environment example is a reference, not an automatically loaded file.
Use the complete `/api/v1` URL. Android emulators use `10.0.2.2`; physical phones
use the computer's LAN IP; browser/iOS simulator use `localhost`.
Restart development servers after changes and rebuild client production bundles.
Do not expose server secrets through public variables.

## Common commands

From the repository root:

```powershell
pnpm dev:mobile
pnpm dev:staff
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @polyaero/staff test
pnpm build:staff
```

Run servers in separate terminals. `pnpm test` runs the shared package tests, not
every workspace's tests. See [mobile testing](../apps/mobile/README.md) and
[API testing](../apps/api/README.md) for their separate suites.

## Prototype versus live behavior

`EXPO_PUBLIC_USE_MOCK_DATA=true` enables explicit mobile demo flows. The default
is live API mode; a working database and member account are required for the
integrated flows. The local SmartTag simulator and Next.js mock API remain
separate from persisted PostgreSQL operations.

Browser/Expo Go testing does not exercise native NFC. Use an Expo development
client for compatible physical phones, and follow the
[firmware wiring/deployment guide](../apps/firmware/micropython-esp32c6/README.md)
for the standalone ESP32-C6 bridge.
