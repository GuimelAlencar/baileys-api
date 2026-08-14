# Data Model: User Authentication with JWT

**Branch**: `001-user-auth-jwt` | **Date**: 2026-08-13

## Entities

### User

Represents a system account that can authenticate and use the API.

| Attribute | Type | Constraints | Notes |
|-----------|------|-------------|-------|
| `id` | UUID | Primary key, auto-generated | Never recycled |
| `email` | string (max 255) | Unique, not null, lowercase | Login identifier |
| `display_name` | string (max 100) | Not null | Admin-editable |
| `password_hash` | string (max 255) | Not null | bcrypt hash; raw password never stored |
| `role` | enum (`admin`, `operator`) | Not null | Determines endpoint permissions |
| `is_active` | boolean | Not null, default true | false = deactivated; cannot log in |
| `created_at` | timestamp with tz | Not null, default now() | Immutable after creation |
| `updated_at` | timestamp with tz | Not null, default now() | Updated on every write |

**Uniqueness**: `email` must be unique across all users (active and deactivated).

**Validation rules**:
- `email` must conform to standard email format; stored in lowercase
- `display_name` must be 1–100 characters, non-empty after trimming
- `password_hash` is always produced by bcrypt; plain-text password is never persisted
- `role` must be exactly one of `admin` or `operator`

---

### RefreshToken

Tracks active refresh tokens issued to users. Enables selective revocation (single-token
invalidation on use) and global revocation (logout — all tokens for a user).

| Attribute | Type | Constraints | Notes |
|-----------|------|-------------|-------|
| `id` | UUID | Primary key, auto-generated | |
| `user_id` | UUID | Foreign key → `users.id`, not null, cascade delete | |
| `token_hash` | string (max 64) | Unique, not null | SHA-256 hex digest of raw token |
| `expires_at` | timestamp with tz | Not null | Issued time + 7 days |
| `is_revoked` | boolean | Not null, default false | true = invalidated (used or logged out) |
| `created_at` | timestamp with tz | Not null, default now() | |

**Lookup key**: `token_hash` — the server hashes the client-presented raw token with SHA-256
and queries by digest. The raw token is never stored.

**Revocation rules**:
- On refresh: the matching row's `is_revoked` is set to `true`; a new row is inserted.
- On logout: all rows for the `user_id` are set `is_revoked = true`.
- On deactivation: all rows for the `user_id` are set `is_revoked = true`.
- A token is considered valid only if: `is_revoked = false` AND `expires_at > NOW()`.

---

## Relationships

```
User ──< RefreshToken   (one-to-many; cascade delete on user removal)
```

A user may have zero or more active refresh tokens (one per active login session / device).
Deleting a user also deletes all their refresh tokens (ON DELETE CASCADE).

---

## State Transitions

### User Lifecycle

```
             create (admin)
                  │
                  ▼
            [active]  ◄─── re-activate (future)
                  │
         deactivate (admin)
                  │
                  ▼
           [inactive]
```

- Active users can: log in, refresh tokens, call permitted endpoints.
- Inactive users cannot: log in or use refresh tokens. Existing access tokens remain valid
  until natural expiry (max 20 min).
- Re-activation is not in scope for MVP (requires direct data-layer intervention).

### Refresh Token Lifecycle

```
        login / refresh
              │
              ▼
          [active]
         /    |    \
        /     |     \
   use()  expire() revoke()
      │       │       │ (logout / deactivate)
      ▼       ▼       ▼
  [revoked] [expired] [revoked]
```

All terminal states are permanent — refresh tokens are never reactivated.

---

## Database Schema (logical)

```sql
-- Table: users
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role         VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'operator')),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Table: refresh_tokens
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    is_revoked  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_users_email ON users(email);
```

---

## Permission Matrix

| Endpoint group | `admin` | `operator` |
|----------------|---------|-----------|
| POST /auth/login | public | public |
| POST /auth/refresh | public | public |
| POST /auth/logout | ✅ | ✅ |
| POST /users | ✅ | ❌ |
| GET /users | ✅ | ❌ |
| GET /users/:id | ✅ | ❌ |
| PUT /users/:id | ✅ | ❌ |
| PATCH /users/:id/deactivate | ✅ | ❌ |
| GET /api/phones | ✅ | ✅ |
| GET /api/phones/:id | ✅ | ✅ |
| GET /api/phones/:id/status | ✅ | ✅ |
| GET /api/phones/:id/qrcode | ✅ | ✅ |
| POST /api/phones | ✅ | ❌ |
| PUT /api/phones/:id | ✅ | ❌ |
| DELETE /api/phones/:id | ✅ | ❌ |
| POST /api/messages/send | ✅ | ✅ |
| POST /api/messages/send-pdf | ✅ | ✅ |
| GET /health | public | public |
| GET /api/status | ✅ | ✅ |
| GET /api-docs | public | public |
