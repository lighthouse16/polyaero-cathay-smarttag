# Staff UI / backend handoff

Branch: `feat/flight-first-transfer-control`.

## Run

```sh
pnpm install --frozen-lockfile
pnpm --filter @polyaero/staff dev
pnpm --filter @polyaero/staff test
pnpm --filter @polyaero/staff lint
pnpm --filter @polyaero/staff typecheck
pnpm --filter @polyaero/staff build
```

Copy `apps/staff/.env.example` to `apps/staff/.env.local`. Never commit real credentials. Configure the same server-only variables in deployment settings; local env files are not deployed by Git.

## HTTP contracts

| Portal route | Contract / integration |
| --- | --- |
| `GET /api/v1/transfer-control` | `TransferControlSnapshot` in `apps/staff/src/lib/types.ts`; live adapter currently reads `${NEXT_PUBLIC_API_URL}/baggage/dashboard`. |
| `GET /api/v1/recovery-performance?window=7d&station=HKG&outboundLegId=all` | `RecoveryPerformanceReport`; windows `24h`, `7d`, `30d`. Live adapter derives report from dashboard input; not an independent persisted recovery ledger. |
| `POST /api/v1/copilot/chat` | `{messages:[{role:"user",content:"..."}],context:null}`; context schema `CopilotContextPayload` in `apps/staff/src/lib/copilot.ts`. |
| Existing bag actions | `POST /baggage/{tag}/scan` and `POST /baggage/{tag}/risk/apply` under backend API base. |

Copilot streaming response is newline-delimited JSON (`application/x-ndjson`):

```json
{"type":"meta","mode":"openai-api","provider":"configured-model"}
{"type":"thought_step","step":"Reading operational snapshot"}
{"type":"text_delta","delta":"Response text"}
{"type":"done"}
```

Failures emit `{"type":"error","message":"..."}`. Custom upstream selected by `COPILOT_API_URL` receives `messages`, `context`, `systemPrompt`, `stream:true`; client also accepts OpenAI-compatible SSE.

## Provider selection

Priority: `COPILOT_API_URL`, `OLLAMA_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` / `LLM_API_KEY`, then deterministic snapshot preview. Configure only intended provider. 9router uses `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL=ag/gemini-3.8-flash-high`.

`http://127.0.0.1:20128/v1` works only where 9router runs. Deployed backend needs authenticated reachable gateway. Mini PC migration is NOT verified complete; do not assume this branch creates hosting or cloud connectivity.

## Limits / release notes

- No new npm dependencies. ThoughtLine uses native Web Animations API and CSS.
- Passenger-name/booking-reference/seat fields omitted from frontend operational context. Do not attach real passenger data without authorization.
- Portal routes currently have no production staff-auth gate; protect access and apply quotas before public deployment with paid model credentials.
- Existing live adapter synthesizes some missing schedule/connection/risk/recovery fields; replace with authoritative backend data before treating metrics as verified operational telemetry. See `liveTransferAdapter.ts` and tests.
- Browser visual/E2E verification remains outstanding. Automated tests and production build do not certify browser UX or production readiness.
- Compiled Next.js output and secrets stay out of Git. CI/deployment rebuilds source.
