# Authentication Flow

## Roles

### Super Admin

The library owner. Full access to students, seats, shifts, fees, reports, staff accounts, backups, exports, and deletion.

### Staff

Operational access for front desk users. Staff can help manage students, attendance, fees, seats, and shifts, but cannot access owner-only exports, backups, staff creation, or delete records.

### Student

Self-service access only. Students can view their own profile, attendance, fee status, and receipts.

## Login Flow

1. User submits email/mobile and password.
2. Server finds an active user by email or mobile.
3. Password is verified against the stored PBKDF2 hash and salt.
4. Server issues a signed token containing user ID, role, optional student ID, issue time, and expiry.
5. Frontend stores the token in local storage for this starter.
6. Every API request sends the token in the `Authorization` header.
7. Server verifies signature, expiry, user status, and role permissions per endpoint.

## Inactivity Logout

The frontend tracks user activity and signs out after 20 minutes of inactivity. Production should pair this with refresh token expiry and server-side session invalidation.

## Production Hardening

- Prefer Argon2id or bcrypt for password hashing.
- Store refresh tokens as hashed, rotating records.
- Use secure, HTTP-only cookies if the app and API share a domain.
- Add MFA for owner accounts.
- Add audit events for logins, failed logins, exports, deletes, and payment edits.
- Lock accounts after repeated failed login attempts.
- Use signed QR attendance payloads with short expiration windows.
- Keep student self-service endpoints scoped by `studentId` from the token, not by user-submitted IDs.

