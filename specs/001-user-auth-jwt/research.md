# Research: User Authentication with JWT

**Branch**: `001-user-auth-jwt` | **Date**: 2026-08-13

## Decision 1: Migration Tool

**Decision**: `node-pg-migrate`

**Rationale**: The project has no existing ORM or migration tooling. `node-pg-migrate` is a
lightweight runner that accepts plain SQL (or JS) migration files, tracks applied migrations
in a `pgmigrations` table, and requires zero schema abstraction layer. This aligns with the
constitution's Principle V (Simplicity & YAGNI) and Principle VII (Schema Migration Policy —
append-only, versioned). Prisma was evaluated and rejected because it introduces a generated
client, a `schema.prisma` DSL, and a heavyweight build step that conflict with the project's
minimal-dependency stance.

**Alternatives considered**:
- **Prisma**: Rejected — ORM overhead, generated client, not aligned with project's simplicity principle
- **Flyway / Liquibase**: Rejected — Java tooling, incompatible with Node.js toolchain
- **Manual SQL scripts**: Rejected — no migration state tracking, violates Principle VII

---

## Decision 2: Refresh Token Storage Strategy

**Decision**: Store a SHA-256 hex digest of the raw refresh token value in the database.
The raw (undigested) token is returned to the client once at issuance and never stored.

**Rationale**: Storing raw refresh tokens in the database means a database breach directly
exposes all active sessions. Hashing with SHA-256 (a fast, collision-resistant digest — not
bcrypt, because refresh tokens are already high-entropy random strings) prevents that while
adding negligible latency. On refresh/logout, the client presents the raw token; the server
hashes it and queries by digest. This follows the same principle as password hashing but uses
SHA-256 because token values are already cryptographically random (no need for slow KDF).

**Alternatives considered**:
- **Store raw token**: Rejected — database breach exposes all sessions
- **Encrypt token**: Rejected — requires key management; SHA-256 digest is sufficient for
  high-entropy random strings

---

## Decision 3: Rate Limiting Library

**Decision**: `express-rate-limit` (in-memory store, per-IP, applied only to POST /auth/login)

**Rationale**: The project already uses Express; `express-rate-limit` is the de-facto standard
rate limiter for Express apps with zero additional dependencies. For MVP with a single-container
deployment, an in-memory store is sufficient. The limit (default: 10 attempts per minute per IP)
and window are read from environment variables at startup, satisfying Principle VIII.

**Alternatives considered**:
- **rate-limiter-flexible** with Redis: Rejected — requires Redis infrastructure; overkill for
  MVP single-instance deployment
- **Manual middleware**: Rejected — reinventing the wheel; `express-rate-limit` is well-tested

---

## Decision 4: Testing Framework

**Decision**: `jest` + `supertest`

**Rationale**: `jest` is the dominant Node.js test runner with built-in assertions, mocking,
and coverage. `supertest` wraps the Express app and lets tests make real HTTP calls against it
without starting a server, enabling fast, deterministic integration tests. This combination
covers all test categories required by constitution Principle IX: auth logic unit tests (jest
alone) and route/permission integration tests (jest + supertest). Mocha/Chai was considered but
jest's all-in-one setup reduces configuration overhead.

**Alternatives considered**:
- **Mocha + Chai + supertest**: Rejected — requires separate assertion library; more setup
- **Vitest**: Rejected — better suited for ESM projects; project uses CommonJS

---

## Decision 5: PostgreSQL Driver

**Decision**: `pg` (node-postgres) — raw pool, no query builder

**Rationale**: The project avoids ORMs (Principle V). `pg` is the canonical PostgreSQL driver
for Node.js. Using a raw `Pool` with parameterized queries is sufficient for the small schema
(2 tables, simple CRUD). A query builder (Knex) was considered but adds abstraction without
clear benefit at this scale.

**Alternatives considered**:
- **Knex**: Rejected — adds query-builder abstraction that isn't needed for 2-table schema
- **Prisma ORM**: Rejected — see Decision 1 rationale

---

## Decision 6: Role Authorization Strategy

**Decision**: On every authenticated request, after JWT signature validation, the middleware
fetches the user's current role from PostgreSQL. Role is NOT trusted from the JWT payload.

**Rationale**: Decided in clarification session (Q2). This ensures role changes made by admins
take effect on the target user's very next request without requiring token re-issuance. The
latency cost (1 DB query per request) is acceptable at the cooperative's scale. The JWT still
carries `sub` (user id) so the lookup requires only a primary-key fetch, which is fast.
To reduce load further, a short TTL in-memory cache (e.g., 30-second Node.js Map) may be
added during implementation if profiling shows it is needed — but this is not required by
the spec.

**Alternatives considered**:
- **Trust role from JWT payload**: Rejected — role changes would not take effect until the
  current access token expires (up to 20 minutes). Rejected in clarification (Q2 → Option B).

---

## Decision 7: Auth Middleware Mounting Strategy

**Decision**: Mount `authenticate` middleware globally in `index.js` using Express's
`app.use()`. Maintain an explicit allowlist of public paths (`/auth/login`, `/auth/refresh`,
`/health`, `/api-docs`, `/api-docs.json`). All other routes are protected by default.

**Rationale**: The spec mandates that "all new routes default to protected; public access is
explicitly opt-in." A global middleware with an allowlist enforces this invariant without
requiring every route file to remember to add the guard. The authorize middleware (role check)
is applied per-route-group because different endpoints have different role requirements.

**Alternatives considered**:
- **Per-route middleware**: Rejected — easy to forget on a new route; violates the
  "protected by default" principle in the spec's Assumptions section

---

## Summary Table

| Topic | Decision | Key Constraint |
|-------|----------|---------------|
| Migration tool | node-pg-migrate | SQL-native, no ORM |
| Refresh token storage | SHA-256 hash of raw token | DB breach safety |
| Rate limiter | express-rate-limit (in-memory) | Configurable via env var |
| Test framework | jest + supertest | Constitution Principle IX |
| PG driver | pg raw Pool | No ORM/query-builder |
| Role resolution | DB lookup per request | Immediate role-change effect |
| Auth middleware | Global + public-path allowlist | Protected by default |
