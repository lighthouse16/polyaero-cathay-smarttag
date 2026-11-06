# PolyAero Cathay SmartTag Development Guide

## 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` (Tested on `v22.21.0`)
- **Package Manager**: `pnpm` (Tested on `v10.33.0`)
- **Mobile Development**:
  - Expo Go (iOS/Android) or iOS Simulator / Android Emulator
  - For native NFC hardware testing: Expo Development Build (`eas-cli`)

---

## 2. Quickstart

### Step 1: Clone Repository
```bash
git clone https://github.com/lighthouse16/polyaero-cathay-smarttag.git
cd polyaero-cathay-smarttag
```

### Step 2: Install Workspace Dependencies
```bash
pnpm install
```

### Step 3: Run Development Servers
- **Mobile App (Expo)**:
  ```bash
  pnpm dev:mobile
  ```
  Press `w` to open in web browser, or scan QR code with Expo Go.

- **Ground Staff Portal (Next.js)**:
  ```bash
  pnpm dev:staff
  ```
  Open `http://localhost:3000` in your browser.

---

## 3. Monorepo Commands

| Command | Action |
|:---|:---|
| `pnpm install` | Install and link all workspace dependencies |
| `pnpm typecheck` | Run strict TypeScript checks across all packages |
| `pnpm test` | Run Vitest unit tests in `@polyaero/shared` |
| `pnpm build:staff` | Create production Next.js build of Staff Portal |
| `pnpm format` | Auto-format codebase using Prettier |

---

## 4. Environment Variables
Local development functions completely offline using realistic mock fixtures.
To connect to a live Supabase project:
1. Copy `.env.example` to `.env.local`
2. Update `EXPO_PUBLIC_SUPABASE_URL` and keys.
