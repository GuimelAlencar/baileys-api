# Quickstart Validation Guide: User Authentication with JWT

**Branch**: `001-user-auth-jwt` | **Date**: 2026-08-13

This guide walks through the end-to-end validation scenarios that confirm the auth feature
works correctly. Run these after implementation to verify all flows before marking tasks done.

## Prerequisites

- Docker and Docker Compose installed
- `curl` and `jq` available in your shell

## 1. Start the stack

```bash
docker compose up -d --build
```

Wait for the `postgres` health check to pass before proceeding:

```bash
docker compose ps   # postgres should show "healthy"
```

## 2. Run database migrations

```bash
docker compose exec baileys-api npm run migrate:up
```

Expected output: migration `001_create_users_and_refresh_tokens` applied.

## 3. Seed the initial admin user

```bash
docker compose exec baileys-api npm run seed:admin
```

This creates: `admin@example.com` / `Admin@1234` with role `admin`.
See `src/scripts/seed-admin.js` for the seeding script.

## 4. Validate: Login

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@1234"}' | jq .
```

**Expected**: HTTP 200, body contains `data.accessToken`, `data.refreshToken`, `data.expiresIn`.

Save the tokens:

```bash
ACCESS_TOKEN="<paste accessToken here>"
REFRESH_TOKEN="<paste refreshToken here>"
```

## 5. Validate: Protected route works with valid token

```bash
curl -s http://localhost:3000/api/phones \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected**: HTTP 200 with phone list (empty array is fine for a fresh instance).

## 6. Validate: Protected route rejected without token

```bash
curl -s http://localhost:3000/api/phones | jq .
```

**Expected**: HTTP 401, `success: false`.

## 7. Validate: Token refresh (single-use rotation)

```bash
# Refresh using the refresh token
NEW_TOKENS=$(curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq .)
echo $NEW_TOKENS

# Attempt to reuse the same refresh token — must be rejected
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | jq .
```

**Expected**: First call → HTTP 200 with new token pair. Second call (reuse) → HTTP 401.

Update your tokens:

```bash
ACCESS_TOKEN=$(echo $NEW_TOKENS | jq -r '.data.accessToken')
REFRESH_TOKEN=$(echo $NEW_TOKENS | jq -r '.data.refreshToken')
```

## 8. Validate: Create a new operator user

```bash
curl -s -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operator@example.com",
    "displayName": "Test Operator",
    "password": "Op3r@t0r!",
    "role": "operator"
  }' | jq .
```

**Expected**: HTTP 201 with new user object (no password field).

## 9. Validate: Operator permission boundaries

```bash
# Log in as the operator
OP_TOKENS=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@example.com","password":"Op3r@t0r!"}' | jq .)
OP_TOKEN=$(echo $OP_TOKENS | jq -r '.data.accessToken')

# Operator CAN list phones
curl -s http://localhost:3000/api/phones \
  -H "Authorization: Bearer $OP_TOKEN" | jq .success
# Expected: true

# Operator CAN send a message (if a connected phone exists)
# (skip if no connected phone)

# Operator CANNOT create a phone
curl -s -X POST http://localhost:3000/api/phones \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"5511999999999","displayName":"Test"}' | jq .
# Expected: HTTP 403, success: false

# Operator CANNOT access user management
curl -s http://localhost:3000/users \
  -H "Authorization: Bearer $OP_TOKEN" | jq .
# Expected: HTTP 403, success: false
```

## 10. Validate: Role change takes effect immediately

```bash
# As admin, change operator to admin
USER_ID="<paste operator user id from step 8>"
curl -s -X PUT http://localhost:3000/users/$USER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}' | jq .role
# Expected: "admin"

# OP_TOKEN still valid — but next request now has admin permissions
curl -s http://localhost:3000/users \
  -H "Authorization: Bearer $OP_TOKEN" | jq .success
# Expected: true (role took effect on this request without re-login)
```

## 11. Validate: Deactivate a user + refresh token revoked

```bash
# Deactivate the operator
curl -s -X PATCH http://localhost:3000/users/$USER_ID/deactivate \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .data.isActive
# Expected: false

# Operator's refresh token is now revoked — refresh must fail
OP_REFRESH=$(echo $OP_TOKENS | jq -r '.data.refreshToken')
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$OP_REFRESH\"}" | jq .
# Expected: HTTP 401, success: false
```

## 12. Validate: All-devices logout

```bash
# Log in as admin from two "devices" (two separate curl calls)
SESSION_A=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@1234"}' | jq .)
SESSION_B=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@1234"}' | jq .)

TOKEN_A=$(echo $SESSION_A | jq -r '.data.accessToken')
REFRESH_B=$(echo $SESSION_B | jq -r '.data.refreshToken')

# Log out using session A's access token
curl -s -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN_A" | jq .
# Expected: success: true

# Session B's refresh token must now be revoked
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_B\"}" | jq .
# Expected: HTTP 401, success: false
```

## 13. Validate: Login rate limit

```bash
# Send 11+ rapid login attempts with wrong password from same IP
for i in $(seq 1 12); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"wrongpassword"}')
  echo "Attempt $i: $STATUS"
done
# Expected: first 10 return 401, 11th+ return 429
```

## 14. Validate: Swagger documentation includes auth endpoints

```bash
curl -s http://localhost:3000/api-docs.json | jq '.paths | keys'
# Expected: includes /auth/login, /auth/refresh, /auth/logout, /users, /users/{id}, etc.
```

## 15. Run automated tests

```bash
npm test
```

**Expected**: All tests pass. Coverage must include:
- All authentication outcomes (SC-006)
- All permission boundaries for admin and operator roles
- Message-sending business rules (existing + gated by auth)

---

## Reference

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/auth-api.yml](./contracts/auth-api.yml)
- Spec: [spec.md](./spec.md)
- Environment variables to set in `.env`:
  - `DATABASE_URL` — PostgreSQL connection string
  - `JWT_SECRET` — signing key for access tokens (minimum 32 chars)
  - `JWT_ACCESS_TTL` — access token lifetime (default: `15m`)
  - `LOGIN_RATE_LIMIT_PER_MINUTE` — max login attempts per IP per minute (default: `10`)
