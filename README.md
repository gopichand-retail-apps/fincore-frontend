# FinCore Frontend

React + TypeScript client for the FinCore synthetic banking simulator. It is a standalone repository alongside `fincore-backend`.

## Run locally

Requirements: Node.js and npm.

```sh
npm ci
npm run dev
```

Vite listens on `http://127.0.0.1:5501` and proxies `/api` and `/actuator` to
`http://127.0.0.1:5502` in local development. Both services bind to loopback by default. Start the
backend separately; see its README.

## Checks

ESLint enforces the 120-column, complexity-15, nesting-depth-3, and four-parameter rules.
TypeScript strict mode is enabled. Vitest instruments all `src/**/*.ts` and `src/**/*.tsx`
application modules; only test files are omitted. Coverage is written to the terminal and
`coverage/lcov.info`. The global test gate requires 90% statements, branches, functions, and lines.
The API client, API-mode configuration, and formatting modules each have per-file 95% floors in all
four categories. No production module is excluded.

The latest measurement (2026-11-01) passed 48 tests across 8 files: **95.50% statements, 90.17%
branches, 94.05% functions, and 96.83% lines**. The aggregate and critical-file gates pass, but
not every module individually reaches 90% in every category. Remaining per-file gaps include
`App.tsx` branches (85.71%), `AppShell.tsx` branches (70%), `DashboardPage.tsx` statements,
functions, and lines (75%/60%/80%), `InsightsPage.tsx` branches/functions (80%/85.71%),
`SignInPage.tsx` branches (76.66%), `StatementsPage.tsx` branches (86.36%), and `content.tsx`
statements, branches, and functions (88.09%/86.2%/88.88%).

```sh
npm test
npm run test:coverage
npm run format:check
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
FINCORE_E2E_MODE=true npm run test:e2e
FINCORE_E2E_MODE=false npm run test:e2e
```

The `Quality` GitHub Actions workflow runs the locked install, formatting, lint, threshold-gated
test/coverage, dependency audit, and production build on pushes and pull requests. The build
includes the TypeScript typecheck. The committed Playwright `data-mode.spec.ts` checks backend
profile loading and an API-backed transfer in both mode configurations using an in-memory H2
database; the latest local run passed 1/1 in each mode. The broader role, denial, beneficiary, and
statement-export E2E matrix remains incomplete. The current frontend CI workflow does not run
Playwright because it does not check out the separate backend repository; E2E is currently a local
verification step.

## Demo boundary

Choose a synthetic customer, operations, or auditor profile. The client uses same-origin sessions, CSRF, request IDs, and trace IDs. It does not use external fonts, remote images, analytics, real account registration, banking credentials, or payment providers. No funds move.
This portfolio prototype is not a bank or a production financial service. Local safeguards do not establish legal, privacy, security, or regulatory compliance and cannot guarantee avoidance of fines. Do not expose it publicly or use real financial or personal data without qualified, jurisdiction-specific review.

## API data mode

`src/config.ts` reads `VITE_IS_MOCK` at build time. It defaults to `true` and accepts only the
exact values `true` or `false`; there is no per-tab `sessionStorage` override. Restart Vite or
rebuild after changing it. In local development, mock mode uses the same-origin Vite proxy to
`127.0.0.1:5502` unless `VITE_MOCK_API_BASE_URL` is set. A deployed mock build must set
`VITE_MOCK_API_BASE_URL`.

With `VITE_IS_MOCK=false`, set `VITE_REAL_API_BASE_URL` to the FinCore API origin. This selects the
server API; it does not connect to a bank or move real funds. The client never falls back to the
mock API in this mode. Explicit API origins must use HTTPS except on loopback. Cross-origin
session requests include credentials, so the API must allow the exact frontend origin with
credentialed CORS.

Both modes fetch allowed profile keys and server-assigned roles from
`GET /api/v1/auth/demo-profiles`, then submit the selected key to `POST /api/v1/auth/demo-login`.
The backend owns identity resolution, roles, and the server-managed session. It also supplies
accounts, balances, transfers, and ledger state through the API. `fincore-model.json` contributes
presentation labels for the returned profile keys; it is not a source of profile choices or
financial fixtures. Demo login is restricted to the backend's `local` and `test` profiles.
Production identity and real-database provisioning are not implemented. See
[DATA_MODE_AND_ARCHITECTURE.md](../DATA_MODE_AND_ARCHITECTURE.md).
