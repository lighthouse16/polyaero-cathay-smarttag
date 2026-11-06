# PolyAero Cathay SmartTag Collaboration Guide

## 1. Team Ownership Boundaries

| Feature Stream | Branch Convention | Focus Area |
|:---|:---|:---|
| **Cathay UI Reconstruction** | `feat/cathay-ui` | Pixel-perfect reconstruction of provided Cathay App screenshots (`apps/mobile/src/features/cathay-shell/`) |
| **SmartTag Mobile Experience** | `feat/smarttag-mobile` | Passenger NFC pairing, baggage live tracking, carousel notifications |
| **Backend & Data Layer** | `feat/backend` | Supabase schema migrations, RLS policies, real-time channels |
| **Ground Staff Operations** | `feat/staff-portal` | Next.js ground operations dashboard, baggage recovery tools |

---

## 2. Git & Branching Workflow

1. Always branch from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature-name
   ```
2. Commit with conventional commit prefixes:
   - `feat:` new user-facing functionality
   - `fix:` bug fix
   - `docs:` documentation updates
   - `refactor:` code restructuring without changing behavior
   - `test:` test coverage additions
3. Open a Pull Request targeting `main`.
4. Ensure CI checks pass (TypeScript check, unit tests, Next.js build).

---

## 3. Pull Request Guidelines
- Fill out the PR template (`.github/PULL_REQUEST_TEMPLATE.md`).
- For UI changes in `cathay-shell`, attach screenshot comparisons against the reference.
- Verify that no personal data or secrets are committed.
