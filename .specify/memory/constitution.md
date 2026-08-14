<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Modified principles:
  - IV. Security-Aware Development → expanded with credential hashing rules and
    explicit per-route permission declaration requirement
  - V. Simplicity & YAGNI → updated to reflect PostgreSQL is now planned (not
    indefinitely deferred) once auth/infra work begins
Added sections / principles:
  - VI. Infrastructure as Code (new)
  - VII. Schema Migration Policy (new)
  - VIII. Runtime Configurability (new)
  - IX. Automated Testing — NON-NEGOTIABLE (new)
  - Development Workflow: added test-gate step (#7) and reinforced Swagger-first rule
Removed sections: none
Follow-up TODOs: none — all placeholders resolved
Deferred implementation intents:
  - Add PostgreSQL and MinIO services to docker-compose.yml → /speckit-specify
-->

# Baileys API Constitution

## Core Principles

### I. REST-First Integration

Every feature MUST be exposed as a documented REST endpoint with JSON request/response bodies.
All endpoints MUST be auto-documented via Swagger/OpenAPI 3 **before the route is considered
complete**; undocumented endpoints MUST NOT ship. Text messages, PDF delivery, session
management, and health signals all share the same uniform `{ success, data, message }` envelope.
New capabilities are additions to the REST surface, never side-channels or internal-only
functions.

### II. Layered Architecture (NON-NEGOTIABLE)

The codebase MUST maintain strict layer separation:
`Routes → Controllers → Services → Data/Driver`. No layer may bypass the one below it.
Controllers handle HTTP concerns only (parse input, call service, serialize response).
Services own business logic. SessionManager owns all Baileys interaction.
Data access (JSON DB + filesystem) is the exclusive responsibility of the service layer.
Mixing concerns across layers MUST be rejected in code review.

### III. Session Reliability

WhatsApp sessions are the core operational asset. The following MUST hold at all times:

- Sessions MUST persist to disk (`auth_info/<phoneId>/`) so a container restart does not
  require re-authentication.
- Reconnection MUST be automatic with exponential backoff; a permanent disconnect (ban/logout)
  MUST be detected and surfaced via status endpoints, not silently retried forever.
- A number MUST NOT be used to send messages while its `isConnected` flag is false — the
  service layer enforces this invariant before every send operation.
- QR code generation is a one-time onboarding step per number; re-authentication is only
  required after a permanent disconnection.

### IV. Security-Aware Development (NON-NEGOTIABLE)

Security is a first-class concern at every stage of development. The following rules are
unconditional:

- **Credential storage**: Passwords MUST NEVER be stored in plain text. bcrypt or argon2
  are the only accepted hashing algorithms.
- **Secrets management**: JWT signing keys, database passwords, MinIO credentials, and all
  other application secrets MUST be supplied via environment variables. Hardcoding secrets
  in source files, Dockerfiles, or `docker-compose.yml` is strictly forbidden.
- **Logs**: MUST NOT contain sensitive data (tokens, credentials, message content, PDF payloads).
- **Input validation**: All inputs MUST be validated at the controller boundary (phone format
  E.164, file MIME type, string length limits). No raw user data reaches Baileys or the
  filesystem unvalidated.
- **Path traversal**: `../` patterns MUST be rejected for any filesystem-referenced input.
- **HTTPS**: MUST be enforced in production deployments (via reverse proxy; the app runs HTTP).
- **Authentication and authorization**: JWT or API key authentication MUST be in place before
  any public-facing production deployment. Every route that exposes user data or triggers
  actions MUST explicitly declare its required permission level in both code (middleware) and
  Swagger documentation. Routes MUST NOT silently fall back to unauthenticated access.

### V. Simplicity & YAGNI

The project targets a single use case: low-volume notification delivery (~100 msgs/hour) for a
small cooperative. Features MUST NOT be built speculatively.

- The JSON flat-file database is used for the current MVP. Migration to PostgreSQL is planned
  as part of the auth/infra consolidation phase — it is not indefinitely deferred.
- Each container supports 3–10 phone sessions; horizontal scaling (multiple containers) is the
  path for higher throughput, not in-process complexity.
- Dependencies are selected for minimal footprint: Express over Fastify, Pino over Winston,
  no ORM beyond what PostgreSQL migration requires.

### VI. Infrastructure as Code

All auxiliary backing services (PostgreSQL, MinIO, cache, etc.) MUST be defined in
`docker-compose.yml` as isolated, named services with named volumes. The following constraints
apply:

- Each service MUST use a dedicated named volume — shared or bind-mounted data directories
  are not acceptable for persistent services.
- Service health checks MUST be defined for all stateful services (database, object storage)
  so that the application container waits for them to be ready before starting.
- No auxiliary service is run ad-hoc or installed directly on the host; container definitions
  are the single source of truth for the infrastructure topology.
- Local development and production MUST use the same service definitions, differentiated only
  by environment variable overrides.

### VII. Schema Migration Policy

Database schema changes MUST be managed through versioned, append-only migration files:

- Each schema change MUST introduce a new migration file. Existing migration files MUST NEVER
  be modified retroactively.
- Migrations MUST be sequential and idempotent; applying them in order on a clean database
  MUST reproduce the current schema exactly.
- Migrations are part of the application codebase and MUST be reviewed, tested, and committed
  alongside the feature that requires them.
- Rollback scripts are RECOMMENDED for every migration that drops columns or tables.

### VIII. Runtime Configurability

Operational parameters MUST be adjustable without requiring an application rebuild or
redeployment:

- JWT token TTL, message send rate limits, reconnection attempt counts, and similar operational
  tunables MUST be read from environment variables at startup.
- A change to any of these parameters MUST take effect with a container restart only (no image
  rebuild, no code change).
- Default values MUST be safe and conservative (e.g., low rate limits, short token TTL) and
  MUST be documented in `.env.example` alongside the allowed range or valid options.

### IX. Automated Testing (NON-NEGOTIABLE)

Automated tests are mandatory for all security-critical and business-rule code paths:

- **Authentication logic**: Registration, login, token issuance, token refresh, and logout
  MUST have automated tests. Tests MUST cover both success paths and failure cases (invalid
  credentials, expired tokens, revoked tokens).
- **Authorization / permissions**: Every permission boundary MUST have a test asserting that
  an unauthorized caller is rejected with the correct HTTP status code.
- **Message sending business rules**: Core invariants — sender must be connected, recipient
  number must be valid E.164, file size must be within limits, rate limit must not be exceeded
  — MUST each have a dedicated test.
- Tests MUST run in CI (as part of the Docker build gate or a separate CI step) and MUST pass
  before a PR may be merged.
- A PR that introduces a new auth endpoint, permission check, or message sending rule without
  corresponding tests MUST be rejected in code review.

## Operational Constraints

Baileys relies on reverse engineering of the WhatsApp Web protocol. These limits MUST be
documented and respected by all contributors:

- **Throughput cap**: Do not exceed ~100 messages/hour per phone number to minimize ban risk.
  This limit MUST be enforced by the runtime configurable rate limiter (see Principle VIII).
- **Ban acknowledgment**: Accounts may be suspended by Meta without notice. No SLA can be
  guaranteed. The application MUST fail gracefully and surface this state via status endpoints.
- **Protocol stability**: WhatsApp protocol changes may break Baileys without warning.
  `@whiskeysockets/baileys` is the actively maintained fork; keep it current.
- **Supported message types (MVP)**: text messages and PDF documents only. Images, audio,
  video, groups, and webhooks are deferred to future phases.
- **File size limit**: PDFs MUST be < 100 MB (WhatsApp platform limit), enforced at upload
  time via Multer.

## Development Workflow

1. All changes are branched from `main`: `git checkout -b feature/<slug>`.
2. The server MUST start without errors (`npm start`) before a PR is opened.
3. PR descriptions MUST explain what changed and why, including any Baileys behavior
   implications or ban-risk trade-offs.
4. Swagger/OpenAPI documentation MUST be written or updated **before** the route is considered
   complete — documentation is part of the definition of done, not a post-merge task.
5. Every new auth endpoint, permission check, or message sending rule MUST ship with
   corresponding automated tests (see Principle IX). PRs without tests for these areas MUST
   be rejected.
6. No commit may remove or weaken an input validation rule without an explicit documented
   justification.
7. Docker build MUST succeed: `docker compose build` is part of the acceptance gate.
8. Any new secret or environment variable MUST be documented in `.env.example` with its
   purpose, default value, and accepted range.

## Governance

This constitution supersedes all other informal practices, README guidance, and tribal
knowledge. Any conflict between the constitution and other documentation resolves in favor
of the constitution.

**Amendment procedure:**

- **MAJOR** bump: backward-incompatible API contract changes, removal of a principle, or
  fundamental architecture shifts. Requires explicit decision documented in a PR and ratified
  by the maintainer.
- **MINOR** bump: new principle added, new section, or materially expanded guidance. PR
  description must justify the addition.
- **PATCH** bump: wording clarifications, typo fixes, formatting — no semantic change.

**Compliance:** Every code review MUST verify compliance with Principle II (layered
architecture), Principle IV (security), Principle IX (testing), and the Operational Constraints
(throughput cap, ban-risk exposure). Complexity beyond what the task requires MUST be rejected.

**Version**: 1.1.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
