# Feature Specification: User Authentication with JWT

**Feature Branch**: `001-user-auth-jwt`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Preciso de autenticação baseada em usuário e senha para a API. O sistema deve permitir que um administrador cadastre novos usuários. Cada usuário faz login com email e senha e recebe um token de acesso e um refresh token. Existe uma rota para renovar o token de acesso usando o refresh token, sem precisar logar novamente. Cada usuário possui um papel (role) que define suas permissões dentro da API. O tempo de expiração do token deve ser configurável (por exemplo, 10 ou 20 minutos). Usuários sem token válido não podem acessar nenhuma rota da API, exceto login e refresh. Um administrador deve conseguir listar, editar e desativar usuários."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Login and Token Issuance (Priority: P1)

A user with any role provides their email and password to the login endpoint. Upon successful authentication, they receive an access token valid for the configured duration and a refresh token valid for 7 days.

**Why this priority**: This is the foundation of all authentication. No other feature is usable until login works.

**Independent Test**: Can be fully tested by calling the login endpoint with valid and invalid credentials and verifying the token response and error responses independently.

**Acceptance Scenarios**:

1. **Given** a registered, active user with correct credentials, **When** they submit their email and password, **Then** they receive an access token (expiring after the configured time) and a refresh token.
2. **Given** a user submits an incorrect password, **When** the system verifies credentials, **Then** it responds with an authentication error and no tokens are issued.
3. **Given** a deactivated user account with otherwise correct credentials, **When** they attempt to log in, **Then** the system rejects the request with an error indicating the account is inactive.
4. **Given** a user submits a malformed or missing email, **When** the system validates input, **Then** it responds with a clear validation error before attempting authentication.

---

### User Story 2 - Silent Token Refresh (Priority: P1)

A client whose access token has expired uses its refresh token to obtain a new access token without asking the user to re-enter credentials.

**Why this priority**: Without silent refresh, client applications must force re-login every 10–20 minutes, making the API impractical for automated integrations.

**Independent Test**: Can be fully tested by obtaining a token pair, waiting for the access token to expire, calling the refresh endpoint, and verifying a new token pair is issued and the old refresh token is rejected.

**Acceptance Scenarios**:

1. **Given** a valid, unused refresh token, **When** the client calls the refresh endpoint, **Then** a new access token and a new refresh token are returned, and the old refresh token is immediately invalidated.
2. **Given** a refresh token that has already been used once, **When** a client presents it again, **Then** the system rejects the request with an authentication error and issues no new tokens.
3. **Given** a refresh token that has expired (older than 7 days), **When** the client presents it, **Then** the system rejects the request and the user must log in again.
4. **Given** a refresh token belonging to a deactivated user, **When** the client presents it, **Then** the system rejects the request.

---

### User Story 3 - Admin Creates a New User (Priority: P2)

An administrator creates a new user account by providing the required information, including the user's role. The new user can immediately log in with the supplied credentials.

**Why this priority**: User provisioning is the onboarding gate; no other user can enter the system without this.

**Independent Test**: Can be fully tested by creating a user as admin, then logging in with the new user's credentials and verifying role-based access.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they submit a valid email, name, password, and role, **Then** a new active user account is created and the response contains the user's details (password excluded).
2. **Given** an admin submits an email that is already registered, **When** the system checks for uniqueness, **Then** the request is rejected with a conflict error.
3. **Given** a non-admin user with a valid token, **When** they call the user-creation endpoint, **Then** the system rejects the request with a permission denied error.
4. **Given** an admin submits a password shorter than the minimum length, **When** the system validates input, **Then** the request is rejected with a validation error stating the password requirement.

---

### User Story 4 - Admin Manages Existing Users (Priority: P2)

An administrator can view a paginated list of all users, update a user's name or role, and deactivate a user to permanently revoke their ability to authenticate.

**Why this priority**: Without lifecycle management, there is no way to offboard users or correct provisioning errors.

**Independent Test**: Each operation (list, edit, deactivate) can be tested independently as an admin against an existing user record.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they request the user list, **Then** they receive a paginated list of all users including id, email, name, role, active status, and creation date.
2. **Given** an authenticated admin, **When** they update a user's name or role, **Then** the changes are persisted, the response reflects the updated record, and the target user's new role takes effect on their very next authenticated request — no re-login required.
3. **Given** an authenticated admin, **When** they deactivate a user, **Then** the user's status becomes inactive, subsequent login attempts by that user are rejected, and their refresh tokens are no longer accepted.
4. **Given** an admin attempts to deactivate or edit their own account via the user management interface, **When** the system identifies the target user matches the requester, **Then** the request is rejected to prevent accidental self-lockout.
5. **Given** a non-admin user, **When** they attempt any user management action (list, edit, deactivate), **Then** the system rejects the request with a permission denied error.

---

### User Story 5 - Route Protection for the Entire API (Priority: P1)

Every existing and future API endpoint except login and token refresh requires a valid, non-expired access token. Requests without one are rejected before reaching any business logic.

**Why this priority**: This is the baseline security invariant. Any gap here breaks the entire auth model.

**Independent Test**: Can be tested by calling protected routes without a token, with an expired token, and with a valid token, verifying the correct HTTP responses in each case.

**Acceptance Scenarios**:

1. **Given** a request to any protected endpoint with no Authorization header, **When** the system checks the token, **Then** it responds with an authentication error before executing any business logic.
2. **Given** a request with an expired access token, **When** the system validates it, **Then** it responds with an authentication error that signals the client to refresh.
3. **Given** a request with a valid, non-expired access token, **When** the system validates it, **Then** the request proceeds to the route handler.
4. **Given** a request to the login or refresh endpoint with no token, **When** the system processes it, **Then** it proceeds normally — these two routes are explicitly public.
5. **Given** an operator with a valid token attempts to create or delete a phone, **When** the system checks the role, **Then** the request is rejected with a permission denied error.
6. **Given** an operator with a valid token calls the phone list, phone status, or message send endpoints, **When** the system checks the role, **Then** the request is allowed to proceed.

---

### User Story 6 - Authenticated Logout (Priority: P2)

An authenticated user explicitly terminates their session. All active refresh tokens associated with their account are immediately invalidated across all devices or clients.

**Why this priority**: Without explicit logout, a compromised or shared refresh token remains valid for up to 7 days. All-devices logout closes this window proactively and is the minimum expected auth lifecycle operation.

**Independent Test**: Can be fully tested by logging in from two clients, calling logout on one, then verifying that the refresh token from the other client is also rejected.

**Acceptance Scenarios**:

1. **Given** an authenticated user with a valid access token, **When** they call the logout endpoint, **Then** all refresh tokens associated with their account are immediately invalidated and the response confirms the logout.
2. **Given** a user who has logged in from multiple clients, **When** they log out from any one of them, **Then** refresh tokens from all other clients are also invalidated.
3. **Given** a client that holds a refresh token after the account owner has logged out, **When** the client presents the refresh token to the refresh endpoint, **Then** the request is rejected.
4. **Given** a user whose access token has expired, **When** they attempt to call the logout endpoint, **Then** the request is rejected — the user must refresh their access token first, then log out.

---

### Edge Cases

- What if a user's account is deactivated while they hold a valid access token? Active tokens remain valid until natural expiry (maximum 20 minutes). New logins and refresh attempts are immediately blocked. This short window is the accepted mitigation.
- What if two concurrent requests try to register the same email simultaneously? The system must enforce uniqueness at the data layer; exactly one succeeds and the other receives a conflict error.
- What if the token signing secret is rotated? All existing tokens become immediately invalid; all users must re-authenticate. This is expected and documented operational behavior.
- What if a client presents a token from a different environment or signing key? The system rejects it with a generic authentication error, revealing no details about the signing key.
- What if all admin accounts are deactivated? The system does not automatically prevent this; restoration requires direct data-layer intervention. Operational discipline is the safeguard.
- What if the role data store is unavailable during a request? The system MUST fail closed — the request is rejected with a service error rather than defaulting to a permissive role.
- What if a user's access token expires just before they call logout? They must use the refresh endpoint to obtain a new access token first, then call logout. There is no unauthenticated logout path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a public login endpoint that accepts an email and password and, on success, returns an access token and a refresh token.
- **FR-002**: Passwords MUST NEVER be stored in plain text. They MUST be stored as a secure one-way hash using an algorithm resistant to brute-force attacks.
- **FR-003**: The access token expiration time MUST be configurable via an environment variable with no application rebuild required. The default value MUST be 15 minutes.
- **FR-004**: The system MUST provide a public token refresh endpoint that accepts a valid refresh token and returns a new access token and a new refresh token. The presented refresh token MUST be invalidated immediately upon use (single-use rotation).
- **FR-005**: Refresh tokens MUST expire 7 days after issuance. Expired refresh tokens MUST be rejected.
- **FR-006**: Every API endpoint except login and token refresh MUST require a valid, non-expired access token. Requests without one MUST be rejected with an authentication error before reaching business logic.
- **FR-007**: Each user MUST have exactly one role. On every authenticated request, the system MUST look up the user's current role from the authoritative data store (not from the access token payload alone) to enforce endpoint-level permissions. A role change made by an admin takes effect on the target user's very next authenticated request, with no re-login required.
- **FR-008**: An administrator MUST be able to create a new user by providing email, name, password, and role. The created user MUST be active immediately.
- **FR-009**: An administrator MUST be able to retrieve a paginated list of all users, including each user's id, email, name, role, active status, and creation date.
- **FR-010**: An administrator MUST be able to update a user's name and role.
- **FR-011**: An administrator MUST be able to deactivate a user. A deactivated user MUST NOT be able to log in or use refresh tokens. Existing access tokens remain valid until natural expiry.
- **FR-012**: The system MUST reject any request by an admin to deactivate or modify their own account via the user management interface.
- **FR-013**: All application secrets (token signing keys, etc.) MUST be loaded from environment variables. Hardcoded secrets are forbidden.
- **FR-014**: Every endpoint introduced by this feature MUST be fully documented in the OpenAPI/Swagger specification before the feature is considered complete.
- **FR-015**: The system MUST return specific, user-facing error messages for: invalid credentials, inactive account, missing or expired access token, invalid or used refresh token, insufficient permissions, input validation failures, and login rate limit exceeded.
- **FR-016**: The system MUST enforce role-based access on all protected endpoints according to the following boundaries: `operator` role is permitted to list phones, view phone status, retrieve QR codes, send text messages, and send PDF documents. `operator` role MUST be denied access to phone creation, phone deletion, phone name updates, and all user management endpoints. `admin` role has unrestricted access to all endpoints.
- **FR-019**: The login endpoint MUST enforce a configurable per-IP rate limit. The maximum number of login attempts per minute per IP address MUST be controlled via an environment variable with a safe default (e.g., 10 attempts per minute). Requests that exceed the limit MUST be rejected with a rate-limit error response. This limit MUST be adjustable via environment variable alone, with no application rebuild required.
- **FR-017**: The system MUST emit structured log entries for the following security-relevant events: failed login attempts (including user email and failure reason, never the submitted password), successful logins (user id and timestamp), token refresh completions (user id), logout events (user id), and admin actions on user accounts (acting admin id, target user id, action performed). Log entries MUST NOT include passwords, raw token values, or message content.
- **FR-018**: The system MUST provide a protected logout endpoint. When called by an authenticated user, it MUST immediately invalidate **all** refresh tokens associated with that user's account (all-devices logout). The caller's access token continues to be valid until its natural expiry.

### Key Entities

- **User**: A system account identified by a unique email address. Attributes: unique id, email, display name, hashed password, role, active/inactive status, creation timestamp, last-updated timestamp.
- **Role**: A named permission level assigned to a user. Initial roles and their explicit permission boundaries:
  - `admin`: full access to all endpoints — phone management (create, list, view, update, delete, QR code, status), message sending (text, PDF), and user management (create, list, edit, deactivate, logout).
  - `operator`: read and send access only — list phones, view phone status and QR code, send text messages, send PDFs. Operators MUST NOT create phones, delete phones, update phone display names, or access any user management endpoint.
- **Access Token**: A short-lived credential encoding the user's id (for identification). Grants access to protected endpoints for its configured duration. The user's **role is not authoritative in the token** — it is looked up from the data store on every request to reflect changes immediately. Not stored server-side.
- **Refresh Token**: A single-use, server-tracked credential with a 7-day lifetime. Used exclusively to obtain a new token pair. A user may have multiple active refresh tokens simultaneously (one per login session / device). All are invalidated when the user logs out or is deactivated; individual tokens are also invalidated upon use (rotation).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid credentials completes login and receives a usable token pair in under 2 seconds under normal operating conditions.
- **SC-002**: A client application obtains a new access token via the refresh endpoint in under 1 second, with no user interaction, and can continue using the API without interruption.
- **SC-003**: 100% of requests to protected endpoints without a valid token are rejected before any business logic executes.
- **SC-004**: An admin can complete user creation, role update, and deactivation each in a single API call.
- **SC-005**: A change to the token expiration configuration takes effect on the next issued token without a service restart or code change — only an environment variable update and container restart is required.
- **SC-006**: Automated tests cover all authentication outcomes (valid login, wrong password, inactive account, expired access token, valid refresh, used refresh token, expired refresh token) and all permission boundaries (admin-only routes reject non-admins; operator-only routes reject unauthenticated requests and admin-restricted actions).
- **SC-007**: Every security-relevant event (failed login, successful login, token refresh, logout, admin user action) produces a verifiable structured log entry containing the required fields and excluding sensitive data.
- **SC-008**: A change to the login rate limit setting (attempts per minute) takes effect with only an environment variable update and container restart — no rebuild required.

## Clarifications

### Session 2026-08-13

- Q: Should the system provide an explicit logout endpoint that invalidates the user's session? → A: Yes — a protected logout endpoint that invalidates **all** refresh tokens for the user across all devices (all-devices logout).
- Q: When an admin changes a user's role, when does the new role take effect for active sessions? → A: Immediately on the user's next request — role is looked up from the data store on every authenticated call, not read from the token.
- Q: What specific actions should the `operator` role be permitted to perform within the phone and message endpoints? → A: Operators may list phones, view phone status/QR code, send text messages, and send PDFs. Operators may NOT create phones, delete phones, or update phone display names.
- Q: Which authentication events should the system log for security monitoring? → A: Failed logins (email + reason, no password), successful logins (user id + timestamp), token refreshes (user id), logouts (user id), admin actions on users (acting admin id, target user id, action). Never log passwords, token values, or message content.
- Q: Should the login endpoint enforce its own configurable rate limit independent of infrastructure-level limits? → A: Yes — a configurable per-IP rate limit on the login endpoint (default 10 attempts/minute), controlled via environment variable, no rebuild required.

## Assumptions

- The initial admin user is created through a database seed or one-time setup mechanism. No self-registration endpoint is provided by this feature.
- Two roles are defined for MVP: `admin` and `operator`. Role definitions are not user-configurable; changing available roles requires a new deployment.
- Refresh token expiration is fixed at 7 days for MVP. Making it configurable is deferred.
- Password minimum requirement: 8 characters minimum length. No complexity rules (uppercase, symbols) are enforced in MVP.
- No password reset or "forgot password" flow is in scope for this feature.
- No brute-force account lockout (per-account login attempt counter) is in scope for MVP. Login protection is provided by the per-IP rate limit enforced at the application level (FR-019).
- The system does not prevent the last active admin account from being deactivated by another admin; this is considered an operational risk to be managed outside the system.
- All new routes default to protected (requiring a valid token). Public access is explicitly opt-in (only login and refresh are public).
- The feature assumes a persistent storage layer is available for user records and refresh token tracking. The specific storage technology is out of scope for this specification.
