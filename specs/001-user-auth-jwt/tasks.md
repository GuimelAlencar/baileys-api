# Tasks: User Authentication with JWT

**Input**: Design documents from `specs/001-user-auth-jwt/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.yml

**Tests**: Included — mandatory per constitution Principle IX (automated tests required for
auth logic, permissions, and message-sending business rules).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to (US1–US6 from spec.md)

## Path Conventions

Single project layout: `src/`, `tests/`, `migrations/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, configure tooling, and prepare the project skeleton.

- [x] T001 Install new npm dependencies in package.json: `jsonwebtoken`, `bcrypt`, `pg`, `node-pg-migrate`, `express-rate-limit` (prod); `jest`, `supertest` (dev)
- [x] T002 Add `postgres` service to `docker-compose.yml` with image `postgres:18-alpine`, named volume `postgres_data`, env vars `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, health check `pg_isready`; add `DATABASE_URL` env var and `depends_on: postgres` to `baileys-api` service
- [x] T003 [P] Create `src/config/database.js` — export a `pg.Pool` instance that reads connection string from `DATABASE_URL` env var; log connection errors via existing Pino logger
- [x] T004 [P] Add jest configuration to `package.json`: `"test": "jest"` script, `"jest": {"testEnvironment":"node","testMatch":["**/tests/**/*.test.js"]}` block
- [x] T005 [P] Create `database.json` at project root for node-pg-migrate with `default` pointing to `DATABASE_URL`; add `"migrate:up": "node-pg-migrate up"` and `"migrate:down": "node-pg-migrate down"` scripts to `package.json`

**Checkpoint**: Dependencies installed; tooling configured; postgres service defined in Compose.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, auth middleware, and global route wiring. No user story can be
implemented until this phase is complete.

**⚠️ CRITICAL**: All tasks here must finish before any Phase 3+ work begins.

- [x] T006 Create `migrations/001_create_users_and_refresh_tokens.js` — `exports.up` creates: `users` table (id UUID PK, email VARCHAR UNIQUE, display_name VARCHAR, password_hash VARCHAR, role VARCHAR CHECK IN ('admin','operator'), is_active BOOLEAN DEFAULT TRUE, created_at/updated_at TIMESTAMPTZ); `refresh_tokens` table (id UUID PK, user_id UUID FK→users CASCADE, token_hash VARCHAR(64) UNIQUE, expires_at TIMESTAMPTZ, is_revoked BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ); indexes on `users.email`, `refresh_tokens.user_id`, `refresh_tokens.token_hash`. `exports.down` drops both tables.
- [x] T007 Create `src/scripts/seed-admin.js` — reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` from env; hashes password with bcrypt (12 rounds); upserts row into `users` with `role='admin'`; add `"seed:admin": "node src/scripts/seed-admin.js"` script to `package.json`
- [x] T008 [P] Create `src/middleware/authenticate.js` — extract Bearer token from `Authorization` header; verify with `jsonwebtoken.verify(token, JWT_SECRET)`; on success attach `req.userId = payload.sub`; on missing/invalid/expired token respond 401 `{success:false, error:"Access token missing or expired"}`; skip verification for paths in public allowlist
- [x] T009 [P] Create `src/middleware/authorize.js` — export `authorize(roles)` factory returning Express middleware; fetch user row by `req.userId` from `users` table via pg pool; if user not found or `is_active=false` respond 401; if `user.role` not in `roles` array respond 403 `{success:false, error:"Insufficient permissions"}`; attach `req.user` to request
- [x] T010 [P] Create `src/middleware/loginRateLimiter.js` — export `express-rate-limit` instance with `windowMs: 60000`, `max: parseInt(process.env.LOGIN_RATE_LIMIT_PER_MINUTE ?? '10')`, `standardHeaders: true`, `legacyHeaders: false`; override message to `{success:false, error:"Too many login attempts. Please try again later."}`
- [x] T011 Update `src/index.js` — apply `authenticate` middleware globally via `app.use(authenticate)` with public-path allowlist `['/auth/login', '/auth/refresh', '/health', '/api/status', '/api-docs', '/api-docs.json']`; mount `authRoutes` at `/auth`; mount `userRoutes` at `/users`; import `database.js` to initialize pool on startup
- [x] T012 [P] Update `.env.example` — add entries: `DATABASE_URL=postgresql://user:pass@localhost:5432/baileys`, `JWT_SECRET=change-me-min-32-chars`, `JWT_ACCESS_TTL=15m`, `LOGIN_RATE_LIMIT_PER_MINUTE=10`, `ADMIN_EMAIL=admin@example.com`, `ADMIN_PASSWORD=Admin@1234`, `ADMIN_DISPLAY_NAME=Administrator`
- [x] T013 [P] Update `src/routes/phoneRoutes.js` — import `authorize` from middleware; add `authorize(['admin'])` to `POST /` (create), `PUT /:id` (update), `DELETE /:id` (delete); add `authorize(['admin','operator'])` to `GET /`, `GET /:id`, `GET /:id/status`, `GET /:id/qrcode`
- [x] T014 [P] Update `src/routes/messageRoutes.js` — import `authorize` from middleware; add `authorize(['admin','operator'])` to `POST /send` and `POST /send-pdf`

**Checkpoint**: Schema in place, middleware built, all existing routes protected. Run
`docker compose up -d && npm run migrate:up && npm run seed:admin` and verify server starts.

---

## Phase 3: User Stories 1 & 2 — Login and Token Refresh (Priority: P1) 🎯 MVP

**Goal**: Users authenticate with email + password and silently renew sessions without
re-entering credentials.

**Independent Test**: Run `npm test -- --testPathPattern=auth` after this phase. Steps 4 and 7
of `quickstart.md` must pass.

### Tests for US1 & US2

- [x] T015 [P] [US1] Write `tests/auth.test.js` — login success (200 + token pair), wrong password (401), inactive account (401), malformed email (400), rate limit exceeded after 11 rapid attempts (429); token refresh success (200 + new token pair), used refresh token rejected (401), expired refresh token (401), refresh token of deactivated user (401)

### Implementation for US1 & US2

- [x] T016 [US1] Create `src/services/AuthService.js` with `login(email, password)` method — query user by email; return 401 if not found or `is_active=false`; compare password with `bcrypt.compare`; sign JWT with `{sub: user.id}` payload, `JWT_SECRET`, and `expiresIn: JWT_ACCESS_TTL`; generate cryptographically random 32-byte refresh token; store SHA-256 hex digest in `refresh_tokens` table with `expires_at = NOW() + 7 days`; return `{accessToken, refreshToken, expiresIn: ms(JWT_ACCESS_TTL)/1000}`
- [x] T017 [US1] Add `refresh(rawToken)` method to `src/services/AuthService.js` — SHA-256 hash the raw token; query `refresh_tokens` by `token_hash WHERE is_revoked=false AND expires_at > NOW()`; return 401 if not found; fetch user, return 401 if `is_active=false`; set that row's `is_revoked=true`; insert a new `refresh_tokens` row; return new token pair
- [x] T018 [US1] Create `src/controllers/AuthController.js` — `login(req, res)` and `refresh(req, res)` handlers; validate required fields; call `AuthService` methods; respond with `{success:true, data: tokenPair}` on success; map service errors to correct HTTP codes (400, 401, 429)
- [x] T019 [US1] Create `src/routes/authRoutes.js` — `POST /login` with `loginRateLimiter` (no auth required); `POST /refresh` (no auth required); wire to `AuthController`; add JSDoc `@swagger` annotations matching `contracts/auth-api.yml` for both endpoints

**Checkpoint**: `POST /auth/login` and `POST /auth/refresh` functional. Auth test suite passes.

---

## Phase 4: User Story 5 — Route Protection (Priority: P1)

**Goal**: Every non-public endpoint rejects unauthenticated requests and enforces role boundaries.

**Independent Test**: Run `npm test -- --testPathPattern=permissions`. Steps 5, 6, and 9 of
`quickstart.md` must pass.

### Tests for US5

- [x] T020 [P] [US5] Write `tests/permissions.test.js` — request to `GET /api/phones` without token (401); request with expired token (401); request with valid token succeeds (200); operator `GET /api/phones` (200); operator `POST /api/phones` (403); operator `GET /users` (403); admin `GET /users` (200); operator `POST /api/messages/send` (200 or 503 if no connected phone — not 403); unauthenticated `POST /api/messages/send` (401)

### Implementation for US5

- [x] T021 [US5] Verify integration of `authenticate` + `authorize` middleware across all route files — start app in test mode, run `tests/permissions.test.js`, fix any route mounting order or middleware sequencing issues discovered; confirm `GET /health` and `GET /api-docs` remain public (no token required)

**Checkpoint**: All protected routes reject unauthenticated requests. Role boundaries enforced
for phone and message endpoints.

---

## Phase 5: User Story 3 — Admin Creates New User (Priority: P2)

**Goal**: An administrator can provision a new user account with email, display name,
password, and role.

**Independent Test**: Run `npm test -- --testPathPattern=users` (create-user cases). Step 8
of `quickstart.md` must pass.

### Tests for US3

- [x] T022 [P] [US3] Write user-creation section of `tests/users.test.js` — admin creates user (201 + user object without password_hash); non-admin attempt (403); duplicate email (409); password shorter than 8 chars (400); missing required field (400); created user can log in immediately (200 from `/auth/login`)

### Implementation for US3

- [x] T023 [US3] Create `src/services/UserService.js` with `create({email, displayName, password, role}, requesterId)` method — lowercase and validate email; check uniqueness (409 if duplicate); validate password length ≥ 8; `bcrypt.hash(password, 12)`; insert into `users` table; return user row without `password_hash`
- [x] T024 [US3] Create `src/controllers/UserController.js` with `createUser(req, res)` handler — validate required fields; call `UserService.create()`; respond 201 with `{success:true, data: user}`; map errors to 400/403/409
- [x] T025 [US3] Create `src/routes/userRoutes.js` — `POST /` with `authorize(['admin'])`; wire to `UserController.createUser`; add JSDoc `@swagger` annotation matching `contracts/auth-api.yml` for `POST /users`

**Checkpoint**: `POST /users` functional for admin callers. User-creation test suite passes.

---

## Phase 6: User Story 4 — Admin Manages Existing Users (Priority: P2)

**Goal**: An administrator can list all users, update a user's name or role, and deactivate a
user — with role changes taking effect on the target user's next request.

**Independent Test**: Run `npm test -- --testPathPattern=users` (all cases). Steps 10 and 11
of `quickstart.md` must pass.

### Tests for US4

- [x] T026 [P] [US4] Extend `tests/users.test.js` — list users returns paginated result (200); get user by id (200); get non-existent user (404); update role (200) — target user's next request uses new role without re-login; update display name (200); admin attempt to update own account (400); admin deactivates user (200, isActive=false); deactivated user login rejected (401); deactivated user's refresh token rejected at `/auth/refresh` (401); admin attempt to deactivate own account (400)

### Implementation for US4

- [x] T027 [US4] Add `findAll(page, limit)`, `findById(id)`, and `update(id, {displayName, role}, requesterId)` methods to `src/services/UserService.js` — `findAll` returns `{users, total}`; `update` rejects if `id === requesterId` (self-edit guard); returns updated user without `password_hash`
- [x] T028 [US4] Add `deactivate(id, requesterId)` method to `src/services/UserService.js` — reject if `id === requesterId`; set `is_active=false` in `users`; set `is_revoked=true` for all rows in `refresh_tokens WHERE user_id=id`; return updated user
- [x] T029 [US4] Add `listUsers(req, res)`, `getUserById(req, res)`, `updateUser(req, res)`, and `deactivateUser(req, res)` handlers to `src/controllers/UserController.js`; self-action guard (req.userId === req.params.id) returns 400; map 404 on user not found
- [x] T030 [US4] Add to `src/routes/userRoutes.js` — `GET /` (paginated list), `GET /:id`, `PUT /:id`, `PATCH /:id/deactivate` — all with `authorize(['admin'])`; wire to `UserController`; add JSDoc `@swagger` annotations matching `contracts/auth-api.yml`

**Checkpoint**: All user management endpoints functional. Role changes take effect immediately.
Full user test suite passes.

---

## Phase 7: User Story 6 — Authenticated Logout (Priority: P2)

**Goal**: A user can invalidate all their refresh tokens across all devices in one API call.

**Independent Test**: Run `npm test -- --testPathPattern=auth` (logout cases). Step 12 of
`quickstart.md` must pass.

### Tests for US6

- [x] T031 [P] [US6] Extend `tests/auth.test.js` with logout cases — logout with valid access token (200); after logout, refresh token from same session rejected (401); after logout, refresh token from a second concurrent session also rejected (401); logout without access token (401)

### Implementation for US6

- [x] T032 [US6] Add `logout(userId)` method to `src/services/AuthService.js` — `UPDATE refresh_tokens SET is_revoked=true WHERE user_id=$1 AND is_revoked=false`; return count of revoked tokens
- [x] T033 [US6] Add `logout(req, res)` handler to `src/controllers/AuthController.js` — call `AuthService.logout(req.userId)`; respond 200 `{success:true, message:"Logged out from all devices"}`
- [x] T034 [US6] Add `POST /logout` to `src/routes/authRoutes.js` — requires valid access token (no role restriction; `authenticate` middleware handles this); wire to `AuthController.logout`; add JSDoc `@swagger` annotation matching `contracts/auth-api.yml`

**Checkpoint**: `POST /auth/logout` invalidates all sessions. Logout test cases pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Swagger completeness, structured audit logging, and full validation run.

- [x] T035 [P] Update `src/config/swagger.js` — add `bearerAuth` security scheme definition; ensure `authRoutes.js` and `userRoutes.js` are included in swagger-jsdoc `apis` glob; verify all 9 new endpoints appear in `GET /api-docs.json` (quickstart.md step 14)
- [x] T036 [P] Add structured auth-event logging to `src/services/AuthService.js` using existing Pino logger — `login` failure: `logger.warn({email, reason})` (no password); `login` success: `logger.info({userId})`; `refresh`: `logger.info({userId})`; `logout`: `logger.info({userId, revokedCount})`; never log token values or password hashes
- [x] T037 [P] Add structured admin-action logging to `src/services/UserService.js` — `create`: `logger.info({adminId, newUserId, role})`; `update`: `logger.info({adminId, targetUserId, fields})`; `deactivate`: `logger.info({adminId, targetUserId})`
- [x] T038 Run `npm test` and confirm all tests pass — verify coverage includes every auth outcome and every permission boundary listed in SC-006; fix any failures before proceeding
- [ ] T039 Execute all 15 validation scenarios in `quickstart.md` — confirm end-to-end flows work in the running Docker stack; record any failures and address them

**Checkpoint**: All tests green, Swagger complete, audit logs active, quickstart validated.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 complete — **BLOCKS** all user story phases
- **Phase 3 (US1+US2)**: Requires Phase 2 complete
- **Phase 4 (US5)**: Requires Phase 3 complete (needs tokens from US1 to test protection)
- **Phase 5 (US3)**: Requires Phase 2 complete — can run parallel to Phase 4
- **Phase 6 (US4)**: Requires Phase 5 complete (needs UserService foundation)
- **Phase 7 (US6)**: Requires Phase 3 complete — can run parallel to Phases 5 & 6
- **Phase 8 (Polish)**: Requires all story phases complete

### User Story Dependencies

- **US1+US2 (Phase 3)**: No dependency on other stories
- **US5 (Phase 4)**: Depends on US1+US2 for test tokens; middleware itself built in Phase 2
- **US3 (Phase 5)**: No dependency on US1+US2 (UserService is independent)
- **US4 (Phase 6)**: Depends on US3 (extends UserService and UserController)
- **US6 (Phase 7)**: Depends on US1+US2 (extends AuthService)

### Within Each Phase

- Parallel tasks ([P]) can be started simultaneously
- Tests should be written before implementation (run and confirm they fail first)
- Services before controllers; controllers before routes
- Each phase produces a testable increment

---

## Parallel Opportunities

### Phase 1 — All three [P] tasks can run simultaneously

```
T003 src/config/database.js
T004 jest config in package.json        ← run in parallel
T005 node-pg-migrate config + scripts
```

### Phase 2 — Middleware files are independent

```
T008 authenticate.js
T009 authorize.js                       ← run in parallel
T010 loginRateLimiter.js
T012 .env.example
T013 phoneRoutes.js (add guards)
T014 messageRoutes.js (add guards)
```

### Phase 3 — Tests can be written while service is being built

```
T015 tests/auth.test.js (login+refresh cases)   ← write tests while
T016 AuthService.js login()                      ← implementing service
```

### Phases 5–7 — Can be worked in parallel by separate developers

```
Developer A: Phase 5 (US3 — User Creation)
Developer B: Phase 7 (US6 — Logout)     ← after Phase 3 complete
```

---

## Implementation Strategy

### MVP First (Login + Token Refresh only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**critical blocker**)
3. Complete Phase 3: US1+US2 (Login & Refresh)
4. Complete Phase 4: US5 (Route Protection)
5. **STOP and VALIDATE**: `npm test` passes; quickstart steps 4–6 pass
6. API is now secure — existing functionality protected

### Incremental Delivery

1. Setup + Foundational → Secure skeleton
2. Add US1+US2 + US5 → Full auth flow working (MVP!)
3. Add US6 → Logout capability
4. Add US3 → Admin can provision users
5. Add US4 → Full user lifecycle management
6. Polish → Swagger, logging, final validation

### Parallel Team Strategy (2 developers after Phase 2)

```
After Phase 2 complete:
Dev A: Phase 3 → Phase 4 → Phase 7
Dev B: Phase 5 → Phase 6
Merge: Phase 8 (polish + final tests) together
```

---

## Notes

- [P] = different files, no dependency on concurrent tasks — safe to parallelize
- [Story] label maps each task to its user story for traceability
- Tests MUST be written and confirmed failing before implementing the corresponding code
- Commit after each checkpoint (end of each phase)
- Stop at any checkpoint to deploy and validate incrementally
- Never log passwords, password hashes, raw token values, or message content (constitution Principle IV)
- All new routes must have JSDoc `@swagger` annotations before the phase is considered done (constitution Principle I)
