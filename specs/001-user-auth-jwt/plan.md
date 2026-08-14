# Implementation Plan: User Authentication with JWT

**Branch**: `001-user-auth-jwt` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-user-auth-jwt/spec.md`

## Summary

Add JWT-based authentication and role-based authorization to the Baileys API. Users (managed
by administrators) log in with email + password and receive a short-lived JWT access token and
a longer-lived refresh token. All existing and new routes are protected by an Express middleware
that validates the JWT and looks up the user's current role on every request. Passwords are
hashed with bcrypt; refresh tokens are stored (as SHA-256 hashes) in a dedicated PostgreSQL
table, enabling selective and global revocation. PostgreSQL is added to the existing
docker-compose as an isolated service with a named volume. Migrations are managed with
node-pg-migrate. A configurable per-IP rate limiter protects the login endpoint.

## Technical Context

**Language/Version**: Node.js 20+ (LTS), CommonJS modules, Express 4.x

**Primary Dependencies**:
- `jsonwebtoken` — JWT issuance and verification
- `bcrypt` — password hashing (12 rounds default)
- `pg` — PostgreSQL driver (node-postgres)
- `node-pg-migrate` — SQL-based, append-only migration runner
- `express-rate-limit` — per-IP rate limiting for the login endpoint
- `jest` + `supertest` — unit and integration test framework (new; mandatory per constitution)

**Storage**:
- PostgreSQL 18 (new docker-compose service) — users table, refresh_tokens table
- Existing JSON file DB (`data/phones.json`) — unchanged; phone management continues as-is

**Testing**: jest + supertest. Tests MUST cover all auth outcomes, permission boundaries, and
message-sending business rules (constitution Principle IX).

**Target Platform**: Linux, Docker / Docker Compose

**Performance Goals**: Login response < 2 s; token refresh < 1 s (SC-001, SC-002)

**Constraints**:
- JWT access token TTL: configurable via `JWT_ACCESS_TTL` env var (default `15m`)
- Refresh token TTL: 7 days (fixed for MVP)
- Login rate limit: configurable via `LOGIN_RATE_LIMIT_PER_MINUTE` env var (default `10`)
- All secrets via environment variables — no hardcoding
- Role lookup on every request (not from token payload) — server-side authoritative check

**Scale/Scope**: Small cooperative; handful of admin + operator users; low auth volume

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. REST-First Integration | ✅ PASS | All 7 new endpoints documented in OpenAPI before considered done |
| II. Layered Architecture | ✅ PASS | Routes → Controllers (Auth, User) → Services (AuthService, UserService) → pg pool |
| III. Session Reliability | ✅ PASS | Auth feature is orthogonal to Baileys session management |
| IV. Security-Aware Development | ✅ PASS | bcrypt for passwords; JWT secret via env var; per-route middleware; logs exclude token values |
| V. Simplicity & YAGNI | ✅ PASS | No ORM; node-pg-migrate is minimal; existing JSON DB untouched |
| VI. Infrastructure as Code | ✅ PASS | PostgreSQL added to docker-compose with named volume + health check |
| VII. Schema Migration Policy | ✅ PASS | node-pg-migrate; append-only migrations; no retroactive edits |
| VIII. Runtime Configurability | ✅ PASS | JWT_ACCESS_TTL, LOGIN_RATE_LIMIT_PER_MINUTE configurable without rebuild |
| IX. Automated Testing | ✅ PASS | jest + supertest; all auth paths and permission boundaries covered |

**No violations. Gate passes.**

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth-jwt/
├── plan.md          ← this file
├── research.md      ← Phase 0 output
├── data-model.md    ← Phase 1 output
├── quickstart.md    ← Phase 1 output
├── contracts/
│   └── auth-api.yml ← OpenAPI 3 contract (Phase 1 output)
└── tasks.md         ← Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── config/
│   ├── logger.js           (existing)
│   ├── swagger.js          (existing — updated to include auth routes)
│   └── database.js         (new — pg Pool factory, reads DATABASE_URL from env)
├── controllers/
│   ├── MessageController.js (existing)
│   ├── PhoneController.js   (existing)
│   ├── AuthController.js    (new — login, refresh, logout)
│   └── UserController.js    (new — CRUD + deactivate)
├── middleware/
│   ├── authenticate.js      (new — validates JWT, attaches userId to req)
│   ├── authorize.js         (new — looks up user role from DB, enforces per-route permission)
│   └── loginRateLimiter.js  (new — express-rate-limit instance for POST /auth/login)
├── routes/
│   ├── messageRoutes.js     (existing — add authorize('admin','operator') guard)
│   ├── phoneRoutes.js       (existing — add per-route role guards)
│   ├── systemRoutes.js      (existing — health/status remain public)
│   ├── authRoutes.js        (new — /auth/login, /auth/refresh, /auth/logout)
│   └── userRoutes.js        (new — /users CRUD)
├── services/
│   ├── MessageService.js    (existing)
│   ├── PhoneService.js      (existing)
│   ├── SessionManager.js    (existing)
│   ├── AuthService.js       (new — login, refresh, logout logic)
│   └── UserService.js       (new — user CRUD + deactivate)
└── index.js                 (existing — mount auth middleware globally, add new routes)

migrations/
└── 001_create_users_and_refresh_tokens.js   (new — node-pg-migrate format)

tests/
├── auth.test.js             (new — login, refresh, logout paths)
├── users.test.js            (new — admin user CRUD)
└── permissions.test.js      (new — role boundary enforcement for all route groups)
```

**Structure Decision**: Single project layout following the existing `src/` convention. New code
is additive — no existing files are deleted; existing routes/services are untouched except for
mounting the auth middleware and adding route-level authorization guards.

## Complexity Tracking

No constitution violations to justify.
