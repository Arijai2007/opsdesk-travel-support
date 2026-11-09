> Historical upstream documentation, preserved for reference. Its setup, accounts, deployment and roadmap describe the original IT Helpdesk application. For this repository, use the [OpsDesk README](../README.md) and [setup guide](../OPSDESK_README.md).

# IT Helpdesk Platform

An IT helpdesk application where users can file tickets manually or by chatting with an AI assistant that extracts structured ticket details automatically. Built as a full-stack TypeScript monorepo to explore tool-calling AI integration, Redis-backed rate limiting, and role-based access control end to end.

**Live demo:** https://it-helpdesk.zoltanmolnar.eu/ — deployed and under active development, not the final release. Auth, account self-service, manual ticket filing (create, list, view, close, reopen, message), the agent dashboard (assignment, status transitions, queue), and the AI chat assistant are all live end to end — see [Roadmap](#roadmap).  
**Demo login:** `admin@helpdesk.dev` / `agent@helpdesk.dev` / `agent2@helpdesk.dev` / `customer@helpdesk.dev` — password `password123` for all four (see [seed data](#seed-data))

**API docs:** [docs/api-endpoints.md](https://github.com/Molnar-Zoltan/it-helpdesk/blob/main/docs/api-endpoints.md) 

<!-- ![screenshot](screenshots/dashboard.png) -->

## Why this exists

Most portfolio CRUD apps stop at "create, read, update, delete." This one is built to work through three problems that show up in real production systems, not just ship a form:

- **Turning unstructured input into structured data.** The AI chat path uses tool/function calling (Gemini) so the model returns a validated `{ title, description, priority }` object instead of free text that has to be parsed and guessed at.
- **Bounding the cost of an AI feature.** AI messages are capped per account *and* per IP address per day, both enforced with Redis-backed counters — not just a UI limit, but a real server-side guard, and one that a handful of throwaway accounts can't just add around.
- **Two producers, one contract.** Manual form submissions and AI-extracted tickets both flow through the same `TicketsService` and the same validation rules, so the AI path can never create a ticket the manual path wouldn't allow.

## Features

- Dockerized local dev environment (Postgres + Redis)
- Email/password auth with JWT access + refresh tokens (rotation on refresh, revocation on logout)
- Role-based authorization (`CUSTOMER`, `AGENT`, `ADMIN`)
- Self-service account management: update name, change password, change email, delete account — all under `/users/me`, documented in [docs/api-endpoints.md](api-endpoints.md)
- Session-aware token revocation: password and email changes revoke every other active session while preserving the one that made the change, via a `refreshTokenId` claim embedded in the access token
- GDPR-compliant account deletion: user data is hard-deleted, but their tickets/messages are anonymized rather than destroyed, preserving operational history for the other party (see [docs/schema.md](schema.md#gdpr--account-deletion-behavior))
- Manual ticket creation, end to end: customers can create, list (paginated & sortable), view, close, and reopen their own tickets, and post/read messages on a ticket's thread — full UI at `/tickets`, `/tickets/new`, and `/tickets/:id`, backed by the API documented in [docs/api-endpoints.md](api-endpoints.md#tickets-tickets)
- Redis-backed rate limiting: 5 failed login attempts per email+IP pair within 15 minutes returns a `429` with a real retry countdown, surfaced live in the login form; ticket creation and messages carry a shorter anti-spam cooldown (60s / 10s) protecting the public demo from abuse — documented in [docs/api-endpoints.md](api-endpoints.md#login-rate-limiting)
- Cloudflare Turnstile CAPTCHA on registration: `POST /auth/register` is gated behind a verified Turnstile token (fails closed if Cloudflare's siteverify API is unreachable, since this is a hard anti-bot gate, not an advisory check) — documented in [docs/api-endpoints.md](api-endpoints.md#registration-captcha)
- Agent dashboard: `AGENT`/`ADMIN` users get a ticket queue (`/tickets/queue`, filterable by status/priority/assignment), self-assign or admin-reassign, and agent-driven status transitions (`OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED`) on top of the existing customer-facing lifecycle — full UI at `/tickets/queue` and on each ticket's detail page, backed by the API documented in [docs/api-endpoints.md](api-endpoints.md#tickets-tickets)
- AI chat ticket intake: a site-wide floating "AI Assistant" widget (logged-in customers only) that turns a short conversation into a filed ticket via Gemini tool-calling — same validation and same `TicketsService.create()` as the manual form, with the full exchange saved as the new ticket's message thread. Capped per account *and* per IP address per day (Redis-backed, dual guard), documented in [docs/api-endpoints.md](api-endpoints.md#ai-ai)

Not yet built — see [Roadmap](#roadmap).

## Tech stack

| | |
|---|---|
| **Frontend** | Next.js, TypeScript, Tailwind CSS |
| **Backend** | NestJS, Prisma ORM 7 (driver adapters, Rust-free client), PostgreSQL |
| **AI** | Gemini API (function calling) |
| **Infra** | Redis via ioredis (rate limiting), Docker Compose (local dev) |
| **Deployment** | Vercel (frontend), Google Cloud Run (backend), Neon (Postgres), Upstash (Redis) |
| **Tooling** | npm workspaces monorepo |

## Architecture

```
Next.js (Vercel)
     │
     ▼
NestJS API (Google Cloud Run)
     ├── auth/         JWT issuance, refresh, guards, login rate limiting
     ├── tickets/       manual + AI-created tickets, shared validation
     ├── ai/             Gemini tool-calling, extracts structured tickets
     ├── common/        RateLimitService (Redis-backed primitives, reused by ai/, auth/, and tickets/), shared validators
     ├── redis/         ioredis connection, consumed by common/
     └── users/
     │
     ├──► PostgreSQL (Neon)
     └──► Redis (Upstash)
```

Manual ticket submissions and AI-chat ticket submissions are two separate entry points that both call the same `TicketsService.create()` — see [docs/architecture.md](architecture.md) for the full flow diagram.

`RateLimitService` (Redis-backed, `ioredis` over TCP) is shared across rate-limited surfaces with different policies: login (5 attempts/15 min, email+IP — done, Step 6), ticket creation and messages (60s/10s anti-spam cooldowns, protecting the public demo — done, Step 6), and AI chat (25 req/day/user *and* 100 req/day/IP, both checked together — done, Step 10). Registration uses Cloudflare Turnstile instead of a counter, since CAPTCHA fits a one-shot signup better than a request counter — done, Step 7. See [Roadmap](#roadmap).

Redis is accessed over a plain TCP connection via `ioredis` rather than Upstash's REST client, so the same connection code works unchanged against the local Docker Redis container and against Upstash in production — just a different `REDIS_URL`.

## Getting started

```bash
git clone https://github.com/Molnar-Zoltan/it-helpdesk.git
cd it-helpdesk
npm install

cp backend/.env.example backend/.env
# fill in DATABASE_URL, JWT secrets, GEMINI_API_KEY, REDIS_URL

cp frontend/.env.example frontend/.env
# defaults to BACKEND_API_URL=http://localhost:3001, fine for local dev

docker-compose up -d                          # local Postgres + Redis
npm run prisma:generate --workspace=backend
npm run prisma:migrate --workspace=backend
npm run prisma:seed --workspace=backend
```

Then start both apps at once:

```bash
npm run dev   # runs frontend + backend concurrently via `concurrently`
              # frontend → http://localhost:3000
              # backend  → http://localhost:3001
```

Or run them separately, one per terminal — the two commands are identical apart from the `--workspace` flag:

```bash
npm run dev --workspace=backend    # http://localhost:3001
npm run dev --workspace=frontend   # http://localhost:3000
```

### Seed data

`backend/prisma/seed.ts` creates four demo accounts — an admin, two agents, and a customer — plus twelve sample tickets (all owned by the demo customer) spanning every `TicketStatus` and a mix of priorities, with one message on the first ticket, so the app isn't empty on first run. The four newest tickets are left unassigned (queue material for the agent dashboard); the rest are assigned to `agent@helpdesk.dev`. The second agent, `agent2@helpdesk.dev`, starts with no tickets assigned to it, so there's a real second option when reassigning from the queue:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@helpdesk.dev` | `password123` |
| Agent | `agent@helpdesk.dev` | `password123` |
| Agent | `agent2@helpdesk.dev` | `password123` |
| Customer | `customer@helpdesk.dev` | `password123` |

### Git hooks

`npm install` at the root sets up Husky automatically (`prepare` script). Two hooks run locally:

- **`pre-commit`** — runs [lint-staged](https://github.com/okonet/lint-staged), scoped per workspace: ESLint `--fix` for staged `backend/` and `frontend/` files, Prettier `--write` for `packages/shared/`. Auto-fixable issues are silently corrected and re-staged; genuinely unfixable errors block the commit.
- **`commit-msg`** — runs [commitlint](https://commitlint.js.org/) against the [conventional commit](https://www.conventionalcommits.org/) format already used throughout this repo's history (e.g. `feat(auth): add JWT refresh flow`).

Full type-checking (`tsc --noEmit`) is deliberately **not** run in `pre-commit` — it's too slow for a hook that fires on every commit and tends to push people toward `--no-verify`. It belongs in a `pre-push` hook or CI, neither of which exist yet (tracked as a follow-up).

## Environment variables

Each app owns its own env file — see [`backend/.env.example`](../backend/.env.example) for the full backend list. Notable ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string, used by Prisma's `datasource` config and driver adapter |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets for access and refresh tokens |
| `AI_DAILY_LIMIT` | Max AI chat messages per user per day (default: 25) |
| `AI_DAILY_IP_LIMIT` | Max AI chat messages per IP address per day (default: 100) — a second, looser cap alongside `AI_DAILY_LIMIT` so a per-account limit alone can't be routed around by registering more accounts; see [architecture.md](architecture.md#rate-limiting) |
| `GEMINI_API_KEY` | Gemini API key for AI ticket extraction |
| `REDIS_URL` | Redis connection string — `redis://localhost:6379` locally, `rediss://default:<password>@<host>:6379` on Upstash |
| `LOGIN_RATE_LIMIT_ATTEMPTS` | Failed login attempts before lockout (default: 5) |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES` | Lockout window in minutes (default: 15) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key, used server-side to verify registration CAPTCHA tokens against Cloudflare's siteverify API. The matching public site key lives in the frontend's env instead — see below |
| `ADMIN_RESET_SECRET` | Shared secret required on `POST /admin/demo-reset`'s `x-admin-reset-secret` header. Only the scheduled GitHub Actions workflow holds this — not tied to any user login, so the demo `ADMIN` account itself has no access (see [api-endpoints.md](api-endpoints.md#admin-admin)) |
| `FRONTEND_URL` | Used for CORS config in the NestJS app |

`frontend/.env.example` has two variables:

| Variable | Purpose |
|---|---|
| `BACKEND_API_URL` | NestJS origin, e.g. `http://localhost:3001`. **Server-only** — deliberately not `NEXT_PUBLIC_`, since the browser never calls the backend directly, only this app's own `/api/auth/*` and `/api/backend/*` route handlers do (see [architecture.md](architecture.md#frontend-api-layer--auth-state)). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key, rendered into the `/register` page's CAPTCHA widget. Public by design (`NEXT_PUBLIC_`) — the backend never uses this key, only the secret key above. |

## Project structure

```
frontend/              Next.js app
backend/                NestJS API, Prisma schema/migrations, backend/.env.example
packages/shared/      Types and DTOs shared by both apps
docs/                    Architecture, database, and API notes
```

## Roadmap

Built as a vertical slice per step (DB → API → UI), backend before frontend, so each step ships something demoable rather than sprawling.

**Done**

1. ✅ Monorepo scaffold (frontend/backend/packages/shared, docker-compose Postgres + Redis)
2. ✅ Prisma schema (User, Ticket, Message, AiUsage, IpUsage, RefreshToken) + migration + seed
3. ✅ Auth backend (register, login, JWT, refresh-with-rotation, logout-revocation)
   - 3.5 ✅ Self-service account management (`/users/me` — profile, password, email, delete)
   - 3.6 ✅ Validation hardening (emoji blocking, name/email format, password strength, HIBP check)
   - 3.7 ✅ Pre-commit hooks (Husky + lint-staged + commitlint)
   - 3.8 ✅ Centralized constants/strings
   - 3.9 ✅ Status homepage (replaced Next.js default)
4. ✅ Manual ticket creation, backend
   - 4.1.1 ✅ `POST /tickets`
   - 4.1.2 ✅ `GET /tickets` (list own)
   - 4.1.3 ✅ `GET /tickets/:id`
   - 4.1.4 ✅ Pagination and sorting on `GET /tickets`
   - 4.1.5 ✅ `PATCH /tickets/:id/close` (customer-initiated close)
   - 4.1.6 ✅ `POST`/`GET /tickets/:id/messages` (ticket comment thread)
   - 4.1.7 ✅ `PATCH /tickets/:id/reopen` (customer-initiated reopen)
   - 4.1.8 ✅ Docs pass — README, `api-endpoints.md`, `architecture.md`, `schema.md` updated for all of Step 4
   - 4.1.9 ✅ Extracted seed/demo data into `packages/shared/src/demo-data/` (fixed IDs, relative `daysAgo` offsets instead of frozen timestamps, plaintext demo password kept separate from backend-only bcrypt hashing) — `backend/prisma/seed.ts` now consumes it instead of owning the data inline. Sets up a single source of truth the frontend's planned MSW offline-mode mocking (Roadmap step 5+) will reuse, so the demo looks the same whether the real backend is reachable or not. Also fixed a bug found in the process: the admin seed account never had `role: ADMIN` set, so it silently seeded as `CUSTOMER`.
5. ✅ Frontend — Next.js UI for auth + ticket creation/viewing
   - 5.1 ✅ App shell & design system — UI primitives (Button/Input/TextArea/FormField/Card/Badge/Alert/Spinner), Header/Footer, Tailwind v4 design tokens, `Providers` (TanStack Query) wired into the root layout
   - 5.2 ✅ API client & auth state — BFF proxy pattern: `/api/auth/{register,login,logout,refresh}` route handlers own the httpOnly `hd_access_token`/`hd_refresh_token` cookies (never exposed to client JS), and a catch-all `/api/backend/[...path]` proxy injects the Bearer token server-side for everything else, transparently refreshing and retrying once on a `401`. Browser-side `apiClient` (`lib/api/client.ts`) always calls this app's own `/api/backend/*`, never the NestJS origin directly. `useProfile()` (`lib/queries/use-profile.ts`) is the single source of auth state — no separate auth context. `ACCESS_TOKEN_TTL_MS`/`REFRESH_TOKEN_TTL_MS` promoted from backend-only constants into `@helpdesk/shared` so cookie `maxAge` can't drift from real token lifetime.
   - 5.3 ✅ Auth pages — `/login` and `/register`, `react-hook-form` + `zod` (`lib/validation/auth-schemas.ts`, wrapping `@helpdesk/shared`'s `isValidName`/`isStrongPassword`/`containsEmoji`/length constants so client rules can't drift from the backend DTOs). Register handles the backend's `422 WEAK_PASSWORD_WARNING` (HIBP soft-check) inline: a warning `Alert` with a "use this password anyway" button resubmits with `acknowledgeWeakPassword: true`, rather than blocking with a modal; editing the password afterward clears the warning. Register also validates firstName/lastName/email on blur then live (`mode: "onTouched"`), while password and confirm-password validate live from the first keystroke — the password field drives a live, per-criterion requirements checklist (`PasswordRequirements`, built on granular checks newly exported from `@helpdesk/shared`'s `validation/password.ts`) instead of a single pass/fail message. Both password fields use a new `PasswordInput` (`components/ui/`) with a show/hide toggle. Create-account intentionally stays enabled regardless of password strength — the checklist and submit-time errors already explain what's wrong, so disabling would only hide information. `proxy.ts` (Next 16's renamed `middleware.ts`) redirects an already-authenticated visitor away from `/login`/`/register`, scaffolded with an empty `PROTECTED_ROUTE_PREFIXES` list for 5.4 to extend. `Header` reads `useProfile()`/`useLogout()` for real — logged in shows Tickets plus a `UserMenu` dropdown (user icon → "Signed in as {firstName}", Account, Log out), logged out shows Log in/Sign up. Home page gained an `AuthStatusBanner` client component. `backendFetch` now converts a genuinely unreachable backend into a normal `503` response instead of an uncaught rejection, so register/login show a real "Unable to reach the server" message instead of crashing on `res.json()`. `sonner` added for toast notifications (themed via CSS variables onto the app's own design tokens, not its default richColors) — a green/accent-done success toast on registration, a neutral "Welcome back!" toast on login.
   - 5.4 ✅ Account pages — `/account`, protected by `proxy.ts`, with a tabbed layout (Name / Email / Password / Delete account) synced to a `?tab=` search param. Name tab does a plain `PATCH /users/me`. Password and Email tabs both require `currentPassword` re-verification, reuse the `PasswordRequirements` checklist and `WEAK_PASSWORD_WARNING` soft-confirm flow from register, and revoke every other active session on success (copy is explicit that this happens "the next time they try to refresh," not instantly, since revocation is checked on token refresh rather than on every request — an instant, live revocation check is deferred until the Redis work in Step 6 lands). Delete account sits behind a confirmation `Modal` (new UI primitive, with a focus trap and Escape/backdrop close) and calls `authClient.logout()` before `DELETE /users/me` so cookies are cleared immediately rather than on next refresh. All four tabs disable their mutating controls and show a `DemoAccountNotice` for the three seeded demo accounts, checked via `isDemoUserId` from `@helpdesk/shared` — mirrored on the backend by `UsersService.assertNotDemoAccount()`, which 403s the same four endpoints server-side so the guard can't be bypassed by calling the API directly.
   - 5.5 ✅ Ticket creation — `/tickets/new`, `NewTicketForm` (title `Input`, description `TextArea` with a live char count, priority `Select` defaulting `MEDIUM`), a new `Select` UI primitive (native `<select>` styled to match `Input`/`TextArea`), `useCreateTicket` mutation hook, `/tickets` added to `proxy.ts`'s protected routes. Deliberately **not** demo-account-restricted — `isDemoUserId` only gates the four account self-service mutations, not core ticket filing.
   - 5.6 ✅ Ticket list — `/tickets`, `useTickets` (paginated & sortable, `page`/`sortBy`/`sortOrder` synced to the URL, `keepPreviousData` for flicker-free paging), `StatusBadge`/`PriorityBadge`, `TicketRow`/`TicketPagination`/`TicketSortControls`. `PaginatedResult<T>` and the pagination/sort constants promoted from backend-only into `@helpdesk/shared`, mirroring the earlier `ACCESS_TOKEN_TTL_MS` precedent. `useCreateTicket` now invalidates the list on success.
   - 5.7 ✅ Ticket detail — `/tickets/:id`, `TicketDetailView` (header, description, close/reopen via a shared `TicketStatusModal`, `MessageThread` + `MessageComposer`). Backend gained a `400 TICKET_CLOSED_CANNOT_MESSAGE` guard blocking new messages on a `CLOSED` ticket (reading the thread is unaffected); the composer disables itself with an explanatory note to match. `TicketRow` now links here and the creation form redirects straight to the new ticket instead of the interim inline notice.
   - 5.8 ✅ Docs pass — README, `api-endpoints.md`, `architecture.md` updated for Steps 5.5–5.7 (ticket-frontend architecture section, `TICKET_CLOSED_CANNOT_MESSAGE` error documented on `POST /tickets/:id/messages`).
6. ✅ Redis-backed rate limiting
   - 6.1 ✅ Backend — login rate limiting. `RateLimitService` (`common/services/`) exposes generic Redis primitives (`isLimited`/`increment`/`reset`) over an `ioredis` TCP connection (new `redis/` module), rather than one monolithic guard — `LoginRateLimitGuard` pre-checks the limit before the request reaches `AuthController`, and `AuthService.login` records a failure only on bad credentials and resets the counter on success, so an early typo doesn't cost the rest of the 15-minute window once the password's right. Keyed on email+IP together (`ratelimit:login:{emailHash}:{ipHash}`, both hashed so raw values never sit in Redis) via a shared key-builder util so the guard and service can't drift onto different keys. A `429 LOGIN_RATE_LIMITED` response includes `retryAfterSeconds` read straight off the Redis key's TTL. Required a prerequisite fix: the frontend's BFF talks to the backend server-to-server, so without forwarding the browser's real IP every login would key on the frontend server's own address — `main.ts` now sets `trust proxy` (Cloud Run's Google Front End is the one trusted hop) and `/api/auth/login`'s route handler forwards `x-forwarded-for` explicitly. Also removed the never-used `IpUsage` Postgres model, scaffolded early for a Postgres-backed version of this that Redis superseded.
   - 6.2 ✅ Frontend — login lockout UI. `LoginForm` reads `retryAfterSeconds` off `ApiError` (now carries it through both `apiClient`'s and `authClient`'s error paths) and ticks down a live countdown (`"Too many login attempts. Try again in 2:05."`), disabling submission until it clears — a static "try again later" would've left the user guessing. Follow-up fix after testing: the lockout was scoped only to a countdown, not to which email triggered it, so switching to a different (non-rate-limited) account required a page refresh. Fixed by capturing the attempted email off `loginMutation.variables` and only disabling/showing the alert when the currently-typed email matches the locked-out one.
   - 6.3 ✅ Ticket creation & message cooldowns — anti-spam, not brute-force protection: the three demo accounts' credentials are public and registration has no CAPTCHA yet (Step 7), so either is an easy way to flood the shared demo with junk tickets. `TicketCreateRateLimitGuard` (60s, per-user) and `TicketMessageRateLimitGuard` (10s, per-user-per-ticket) reuse `RateLimitService`, but count *every* attempt rather than only failures — the cost here is the attempt itself, not the outcome, so unlike login these guards are fully self-contained (check-and-increment in one pass, no service-side bookkeeping). `RateLimitService.recordFailure` renamed to the neutral `increment` to fit both shapes cleanly, and `LoginRateLimitedException` refactored onto a shared `RateLimitedException` base alongside the two new ticket exceptions. Frontend: extracted a shared `useRateLimitCountdown` hook (this is now the third near-identical countdown-ticker, worth deduplicating) wired into `NewTicketForm` and `MessageComposer`. Found and fixed a real `react-hooks/set-state-in-effect` lint error while building the hook — calling `setState` synchronously inside a `useEffect` body is exactly the anti-pattern React's docs steer away from; switched to the documented render-phase state-adjustment pattern (compare against the previous error's identity during render, guarded so it only fires once per new error) instead. The same latent pattern exists in `LoginForm`'s own inline version but isn't currently flagged, since an unrelated `watch()` incompatibility warning short-circuits further lint analysis on that file — not fixed here to avoid re-touching already-shipped code without a concrete need, but worth knowing about.
7. ✅ Cloudflare Turnstile on registration
   - 7.1 ✅ Backend — `TurnstileGuard` gates `POST /auth/register`, reading `turnstileToken` off the raw request body the same way `LoginRateLimitGuard` reads `email` (guards run before the `ValidationPipe`, so it's never added to `RegisterDto`). `TurnstileService` (`common/services/`) verifies against Cloudflare's siteverify API — deliberately **fails closed**, unlike the HIBP breach check's fail-open design, since Turnstile is the actual anti-bot gate rather than an advisory signal; an unreachable/slow/erroring siteverify call is treated as a failed verification. Local/sandbox dev uses Cloudflare's official "always passes" test secret key instead of a custom `NODE_ENV` bypass flag, so there's no security-relevant shortcut that could accidentally ship live.
   - 7.2 ✅ Frontend — `TurnstileWidget` (`app/register/_components/`, not yet promoted to `components/ui/` — register is its only consumer so far) loads Cloudflare's script via `next/script`'s `onReady` callback (not `onLoad`, which only fires once per page load and wouldn't re-fire on a client-side return to `/register`), rendering the dark-themed challenge and exposing a `reset()` handle. Wired into `RegisterForm`: both the primary submit and the `WEAK_PASSWORD_WARNING` "use this password anyway" resubmit are disabled until a token exists. Turnstile tokens are single-use, and `TurnstileGuard` spends the token on *every* `POST /auth/register` call regardless of outcome — including the `acknowledgeWeakPassword` resubmit, which is a second call through the same guard. Without accounting for that, the resubmit would fail with Cloudflare's "token already spent" rejection; fixed by resetting the widget and clearing the token after *any* failed submission, not just Turnstile-specific ones.
8. ✅ CI/CD pipeline — automated backend build, migrate, and deploy on every push to `main`
   - 8.1 ✅ Versioning + changelog — `cliff.toml` + a `release` job in `.github/workflows/backend-release.yml` that computes the next semver from conventional-commit history since the last tag (its own grep-based logic, not git-cliff's `[bump]` engine — `no_increment_regex` is accepted in config but confirmed to have no actual effect), generates/prepends `CHANGELOG.md`, bumps `package.json`, and tags `main`. `infra/artifact-registry-cleanup-policy.json` keeps the 3 most recently pushed backend images and deletes anything older than a day regardless of tag state, keeping storage inside Artifact Registry's free tier.
   - 8.2 ✅ GCP Workload Identity Federation — a dedicated `github-actions-deployer` service account, authenticated via WIF and scoped to this repo's `main` branch only (no service account key ever generated, stored, or rotated). Minimal role set: `artifactregistry.writer`, `run.developer`, and `iam.serviceAccountUser` on the Cloud Run service's runtime identity — deliberately not `run.admin`, since deploys never touch the service's own IAM policy.
   - 8.3 ✅ `deploy-backend` job — gated on both a real release (`released == 'true'`) and a `dorny/paths-filter` check on `backend/**`/`packages/shared/**`, so a frontend-only release never rebuilds or redeploys an unchanged backend. Runs `prisma migrate deploy` against Neon from the runner *before* the image is built, so a new revision is never deployed against a schema it doesn't expect; builds/pushes the backend image tagged with the release version plus `latest`; deploys via `google-github-actions/deploy-cloudrun` with no `--set-env-vars`, so the Redis/Turnstile/JWT config already sitting on the Cloud Run service is left untouched. Exercised end-to-end on a real multi-commit `develop`→`main` merge plus a trial `fix:` commit, which surfaced and fixed two real bugs along the way: a missing `checkout` step ahead of `paths-filter` (it runs `git diff` locally, not via the GitHub API, so the job had no `.git` to diff against) and a missing explicit `docker/setup-buildx-action` step.
   - 8.5 ✅ Demo reset — `POST /admin/demo-reset` wipes the whole database and re-seeds the demo fixture, called every ~48 hours by a scheduled GitHub Actions workflow (`.github/workflows/demo-reset.yml`). New `backend/src/admin/` module; `DemoResetGuard` checks a shared-secret header (`ADMIN_RESET_SECRET`) rather than JWT/role, so the endpoint has no dependency on any user session — even the demo `ADMIN` account's own login grants no access. Demo accounts aren't blocked from creating/closing/reopening tickets or posting messages (only the four `/users/me` self-service mutations are), so a full wipe was chosen over a diff-against-seed reset. `backend/prisma/seed.ts`'s insert logic was extracted into `backend/prisma/seed-demo-data.ts` so a fresh `prisma db seed` and a scheduled reset insert byte-identical state through one shared code path.
9. ✅ Agent dashboard — assignment, agent-driven status transitions, and a browsable ticket queue for `AGENT`/`ADMIN`. No schema migration needed; reuses the `agentId`/`status` columns that already existed on `Ticket`. See [architecture.md](architecture.md#agent-dashboard-step-9) for the full design writeup.
   - 9.1 ✅ `PATCH /tickets/:id/assign` — any `AGENT` self-assigns an unassigned ticket; only `ADMIN` reassigns or assigns to a different agent. Unscoped lookup, `403` (not `404`) on a permission failure. A repeat self-assign to the same agent is a true no-op, skipping the write entirely — Prisma's `@updatedAt` fires on every write regardless of whether a value changed, so without this an agent could bump their own ticket's `updatedAt` and climb the queue's default sort for free.
   - 9.2 ✅ `PATCH /tickets/:id/status` — agent-driven transitions via an explicit `ALLOWED_AGENT_STATUS_TRANSITIONS` map: `OPEN ↔ IN_PROGRESS ↔ RESOLVED`, plus any of those three → `CLOSED` with a required reason reusing the same `closeReason`/`closedAt`/`closedBy` columns a customer close writes. Self-transitions are deliberately absent from the map, so a repeat call `400`s instead of rewriting. Assigned agent or `ADMIN` only; an unassigned ticket is `ADMIN`-only.
   - 9.3 ✅ `GET /tickets/queue` — agent/admin browsing view, reusing the `paginateTickets(where, query)` helper structured for this back in 4.1.4. Optional `status`/`priority`/`assignedTo` (`me` | `unassigned` | a literal agent id) filters. Registered before `:id` so it isn't swallowed by the param route. Follow-up fix: `GET /tickets/:id` was still customer-only after 9.1–9.3 shipped, letting an agent see a ticket in the queue but not open its detail page — fixed to allow any `AGENT`/`ADMIN`.
   - 9.4 ✅ `canAccessTicket(ticket, callerId, role)` — one shared visibility rule behind both `findOneForUser` and `assertCanAccessMessages`: owning customer; assigned agent (or any agent while unassigned); or `ADMIN` unconditionally. Narrows the earlier "any `AGENT`/`ADMIN`" rule now that assignment and a queue to claim from both exist. `findQueue` deliberately stays unscoped/broad, since it's a browsing index, not a single resource.
   - 9.5 ✅ Reopen resumes `IN_PROGRESS` (not always `OPEN`) if the ticket still has an `agentId` at reopen time — a closed ticket keeps whatever agent it had, so the previously-assigned agent picks back up rather than the ticket looking unclaimed.
   - 9.6 ✅ Frontend
     - 9.6.1 ✅ `/tickets/queue` — mirrors `/tickets`, reusing `TicketRow`/`StatusBadge`/`PriorityBadge`/`TicketPagination`/`TicketSortControls` as-is; new `TicketQueueFilters`; `TicketRow` gained an optional `currentUserId` prop rendering a You/Unassigned/Assigned badge (queue-only). Role gating is a plain client-side `useProfile()` check, not a `proxy.ts` redirect (which is deliberately presence-only, no JWT decode, by design); `Header` gained a Queue link for `AGENT`/`ADMIN` only. Two follow-up fixes from dogfooding: messages now join and return a `senderName` (previously the thread assumed only the owning customer could ever view it, mislabeling an agent's own messages "Support"); and, once agents could see full names, `senderName` was scoped by viewer role — a `CUSTOMER` viewer sees only an agent's first name (common helpdesk convention), `AGENT`/`ADMIN` viewers see full names for anyone on the thread.
     - 9.6.2 ✅ `TicketAgentControls` on `/tickets/:id` — role-gated assign ("Claim ticket" / "Reassign to me" for admins) and status-transition controls, wired to new `useAssignTicket`/`useUpdateTicketStatus` mutation hooks. Status options come from a small hand-synced client-side copy of the backend's transition map (display-only — nothing in `@helpdesk/shared` to import, since it's a private service detail). A reason field appears only when `CLOSED` is selected.
     - 9.6.3 ✅ Follow-up fixes from review: `POST /tickets` became `CUSTOMER`-only server-side (previously any authenticated role could file a ticket as themselves), mirrored on the frontend by gating the Tickets link, `/tickets`, and `/tickets/new` to customers, with a friendly in-page message for an agent/admin who navigates there directly — flagged as a simplification, since real helpdesk products commonly let an agent file on a customer's behalf instead. Ticket detail's back-link is now role-aware (`Back to queue` vs `Back to tickets`). `TicketRow` blocks navigation into another agent's assigned ticket with a deduplicated toast (`sonner`'s `id` option) instead of letting it 404 through.
   - 9.7 ✅ Docs pass — README, `api-endpoints.md`, `architecture.md` updated for all of Step 9; home page's build-plan panel now shows "Agent dashboard" as done.
   - 9.8 ✅ Seed data follow-up — added a second demo agent (`agent2@helpdesk.dev`, no tickets pre-assigned) so the queue's reassign flow has a real second agent to pick from, and unassigned the 4 newest of the 12 demo tickets so the queue isn't 100% pre-claimed on a fresh seed.
10. ✅ AI chat ticket path — a second, chat-based entry point into ticket creation, alongside (not instead of) the manual form. See [architecture.md](architecture.md#ai-chat-step-10) and [architecture.md#ai-assistant-widget-frontend-step-106](architecture.md#ai-assistant-widget-frontend-step-106) for the full design writeups.
    - 10.1 ✅ Backend — Gemini tool-calling into `TicketsService.create()`. `GeminiClient` (`ai/gemini/`) wraps `@google/genai`, using an `AbortController`+`setTimeout` for the request timeout after the SDK's own `httpOptions.timeout` was confirmed unreliable for `generateContent`. A `create_ticket` `FunctionDeclaration` mirrors `CreateTicketDto`'s fields (`title`/`description`/`priority`) one-for-one; `AiService.chat()` is stateless — the frontend resends the full transcript every turn, nothing is read from or written to persistence unless `create_ticket` actually fires. A successful call runs through the *exact same* `class-validator` rules the manual form's DTO enforces, not a parallel path — a malformed call from the model comes back as an ordinary clarifying chat message, not a hard HTTP error, since it's a model mistake, not a user error. The full conversation (customer turns + the assistant's replies) is persisted as `Message` rows on the new ticket once it's created, so a ticket's detail page shows the exchange that produced it through the same thread UI a manually-created ticket uses.
    - 10.2 ✅ Backend — AI daily rate limit. `AiDailyRateLimitGuard` reuses the same `RateLimitService` Redis primitives as login/ticket-creation, day-scoped keys (`ratelimit:ai:{userId}:{date}`) rather than a rolling TTL window. `GET /ai/usage` (read-only, no guard of its own) lets the frontend show "X of Y used today" without spending a turn to find out. The `AiUsage` Prisma model — scaffolded early for a Postgres-backed version of this counter — was dropped in favor of the Redis-backed one (`drop_ai_usage` migration), the same fate `IpUsage` had in Step 6.
    - 10.3 ✅ Backend — per-IP daily cap, on top of (not instead of) the per-user one. A per-account limit alone doesn't stop someone from registering more accounts to add up several 25s — `AiDailyRateLimitGuard` now checks a second Redis counter (`ratelimit:ai-ip:{ipHash}:{date}`, `AI_DAILY_IP_LIMIT` = 100/day, deliberately 4x looser so a genuinely shared IP never notices it) and blocks on whichever cap is hit first, reusing the same trusted `request.ip` login's rate limiting already established. `GET /ai/usage` reflects the *tighter* of the two caps in its `limit` field rather than always returning the flat per-user number, so a fresh account on an already-heavily-used shared IP shows an accurate "X left." Neither the `429` response nor the usage response names which cap is binding, or any specific number tied to it — see [api-endpoints.md#ai-chat-rate-limiting](api-endpoints.md#ai-chat-rate-limiting) for the reasoning.
    - 10.4 ✅ Frontend — AI Assistant widget. Originally built as a dedicated `/tickets/ai-chat` page, then redesigned into a persistent, site-wide floating widget (Messenger-style: a collapsed bubble that expands into a fixed bottom-right chat window, header titled "AI Assistant") after review — mounted once in the root layout so it's available on every page for a logged-in customer and survives client-side navigation instead of resetting per route. The transcript lives one level up from the open/closed window itself (in `AiAssistantWidget`, not `AiAssistantWindow`) specifically so closing and reopening the widget keeps the conversation, while a successful `ticket_created` still resets it for the next issue. A static greeting bubble (a plain constant, never sent to the backend) opens an empty conversation. `AiAssistantProvider` (React context) lets "Open AI Assistant" buttons elsewhere in the UI (the ticket list, the manual creation form) reach into the widget without prop-drilling.
    - 10.5 ✅ Docs pass — README, `api-endpoints.md`, `architecture.md`, `schema.md` updated for all of Step 10, including the `AiUsage` model's removal.

**Left**

11. ⬜ Knowledge base / RAG — a `KnowledgeArticle` model plus `pgvector` embeddings and a retrieval step the AI assistant checks before (or alongside) `create_ticket` tool-calling. Involves a hand-authored migration for the `pgvector` extension + vector column (Prisma has no native vector type), an embedding pipeline (Gemini's embedding model, run on article create/update plus a backfill script), and raw-SQL similarity search via `$queryRaw` since Prisma Client doesn't model vector ops.
12. ⬜ Admin analytics dashboard (ticket volume, AI usage trends) — deliberately left until after Step 10, since roughly half its planned metrics depend on AI usage data that didn't exist until now.
13. ⬜ Unit/integration tests for backend services and controllers

## License

MIT
