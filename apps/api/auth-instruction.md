Role: Senior Software Engineer

## Project Context

You are implementing a JWT-based authentication and authorization module in an **existing NestJS 12 backend** with the following confirmed project characteristics:

- **Package manager / runtime**: Node.js ESM (`"type": "module"` in `package.json`) — all local imports **must** use `.js` extensions even for `.ts` source files.
- **API prefix + URI versioning**: Global prefix `api`, URI versioning default version `'1'`. All endpoints are therefore served at `/api/v1/...`.
- **Test runner**: **Vitest** (NOT Jest). All test files use `vitest` imports (`describe`, `it`, `expect`, `vi` from `'vitest'`).
- **Env validation**: Joi schema lives in `src/config/env.validation.ts`. `JWT_SECRET`, `JWT_EXPIRES_IN`, and `JWT_REFRESH_EXPIRES_IN` already exist; add and validate issuer, audience, absolute session lifetime, and rate-limit settings.
- **Logging**: `nestjs-pino` / `pino-http` is already wired into `AppModule`. Inject `Logger` from `'nestjs-pino'` for structured logging inside services.
- **ORM**: TypeORM with PostgreSQL. `synchronize: false`. Migrations are managed manually.
- **Rate limiting**: Authentication endpoints need rate limiting. A multi-instance deployment requires a shared store; an in-memory limiter alone is insufficient.

## Existing Entities and Required Schema Changes

The entities below exist today. Extend them only through TypeORM entity changes
and an explicit migration; do not rely on `synchronize` in production.

### `User` (`src/database/entities/user.entity.ts`)

| Field                 | Type                      | Notes                                                                           |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `id`                  | `uuid` PK                 |                                                                                 |
| `email`               | `varchar(255)`            | unique                                                                          |
| `passwordHash`        | `varchar(255)`            | **`select: false`** — must use `.addSelect('user.passwordHash')` in login query |
| `fullName`            | `varchar(200)`            |                                                                                 |
| `mobileNo`            | `varchar(20)` nullable    |                                                                                 |
| `role`                | `enum UserRole`           | `HQ_ADMIN \| OUTLET_MANAGER \| OUTLET_STAFF`                                    |
| `outletId`            | `uuid` nullable           | null for HQ_ADMIN                                                               |
| `isActive`            | `boolean` default true    | must check on login, refresh, and protected requests; auth errors stay generic  |
| `passwordChangedAt`   | `timestamp` nullable      |                                                                                 |
| `lastLoginAt`         | `timestamptz` nullable    | update on successful login                                                      |
| `failedLoginAttempts` | `int` default 0 | consecutive failed-login counter                                                  |
| `lockedUntil`         | `timestamptz` nullable    | account lockout — check before validating password                              |
| `sessions`            | `OneToMany → UserSession` |                                                                                 |

### `UserSession` (`src/database/entities/user-session.entity.ts`)

Tracks each device/client session independently, enabling multi-device login and per-session revocation.

| Field              | Type                    | Notes                                              |
| ------------------ | ----------------------- | -------------------------------------------------- |
| `sessionId`        | `uuid` PK               | embed in JWT payload as `sid` claim                |
| `userId`           | `uuid` FK               |                                                    |
| `deviceId`         | `varchar(100)` nullable | client-supplied opaque device identifier           |
| `deviceName`       | `varchar(100)` nullable | e.g. `"iPhone 15 Pro"`                             |
| `deviceType`       | `varchar(50)` nullable  | e.g. `"mobile"`, `"desktop"`, `"api"`              |
| `os`               | `varchar(100)` nullable |                                                    |
| `browser`          | `varchar(100)` nullable |                                                    |
| `ipAddress`        | `inet` nullable         |                                                    |
| `userAgent`        | `text` nullable         |                                                    |
| `issuedAt`         | `timestamp`             |                                                    |
| `expiresAt`        | `timestamp`             | refresh token expiry — enforce in refresh endpoint |
| `refreshTokenHash` | `varchar(255)`           | `select: false`; bcrypt hash of current refresh token, replaced atomically on rotation |
| `absoluteExpiresAt`| `timestamp`             | **New migration**; maximum lifetime of this login, not extended by refresh |
| `revokedAt`        | `timestamp` nullable    | null = active; non-null = revoked                  |

Keep exactly one current refresh-token hash on each `UserSession`; do not create
a separate refresh-token entity or table. Generate an opaque 32-byte random
secret encoded with `randomBytes(32).toString('base64url')` (43 characters) and
store only `bcrypt.hash(token, 10)` in `refreshTokenHash`. The client sends that
token together with the session ID. `expiresAt` is the current refresh token's
idle expiry. Each successful rotation atomically replaces the stored hash and
updates `expiresAt`; prior token hashes are not retained, so the service cannot
distinguish a replayed old token from any other invalid token and must reject it
without revoking the session.

Add a migration for `UserSession.absoluteExpiresAt` only. Backfill legacy
session absolute expiry from `expiresAt` before making the new column non-null.
Keep the existing `user_sessions.refresh_token_hash` column and its data; do not
drop it or add refresh-token tables/entities. Keep `synchronize: false`.
Normalize existing emails to lowercase before relying on normalized lookup;
detect and resolve any case-insensitive duplicates as an explicit migration
precondition rather than silently choosing an account.

The existing partial unique index allows only one active session per non-null
`(userId, deviceId)`. Preserve that invariant: a new login with a device ID must
revoke the previous active session for the same user/device in the same
transaction before creating its new session. Logins without a device ID and
logins from other devices remain independent.

### `UserRole` enum (`src/common/enums/user.enum.ts`)

```ts
export enum UserRole {
  HQ_ADMIN = 'HQ_ADMIN',
  OUTLET_MANAGER = 'OUTLET_MANAGER',
  OUTLET_STAFF = 'OUTLET_STAFF',
}
```

---

## Objective

Implement a clean, secure, production-ready auth module with **no over-engineering**. The system must:

1. Authenticate users with email + password.
2. Register users with an email address and password.
3. Issue short-lived **access tokens** (JWT) and rotating opaque **refresh tokens**.
4. Support independent multi-device sessions, list/revoke individual sessions, and revoke all sessions.
5. Support access-token validation, refresh-token rotation, logout, and expiry.
6. Support authenticated password change and brute-force/rate-limit defenses.
7. Guard routes with `JwtAuthGuard` (authentication) and `RolesGuard` (authorization).
8. Apply consistent DTO validation, safe errors, structured audit logging, and migration-backed persistence.

Public registration creates an active `OUTLET_STAFF` account with no outlet assigned.
The client must not choose a role or `outletId`; those fields are controlled by
trusted administrative workflows. Registration creates the account only and does
not issue tokens or create a session; the user logs in separately. Public
registration must be rate-limited and must not expose whether an email address is
already registered.

Registration creates an active account immediately, and the user can log in
normally. Email is used only as the normalized account identifier.

Because a public account can initially have `outletId: null`, every outlet-scoped
endpoint must deny access until a trusted administrator assigns an outlet. A role
check alone is not sufficient for outlet data isolation.

Each device login is an independent session. Access tokens are short-lived JWTs;
refresh tokens are opaque, single-use credentials rotated on every successful
refresh. A session has a sliding idle expiration and a fixed absolute expiration
so repeated refreshes cannot extend one login indefinitely.

---

## 1. Install Missing Dependencies

Install only dependencies that are missing from `package.json`:

```bash
# JWT & Passport
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install -D @types/passport-jwt

# DTO validation — required for class-validator decorators to work
npm install class-validator class-transformer
npm install @nestjs/throttler
```

Configure the shared rate-limit store through environment variables validated
by Joi. Never put secrets in source control.

Suggested starting limits (make them explicit configuration, not hidden magic):
login 10 attempts per 15 minutes per IP and normalized email; refresh 30 per
minute per IP and session; registration 5 per hour per IP. Return
`429 Too Many Requests` with a retry interval. Rate limits complement, not
replace, account lockout and must use shared storage in production.

> [!IMPORTANT]
> **`class-transformer` is mandatory alongside `class-validator`**. NestJS's `ValidationPipe` with `transform: true` uses `class-transformer` under the hood to instantiate plain objects as class instances before running decorator validations. Without it, `@Body()` will receive a plain object and decorators like `@IsEmail()` will silently do nothing.

---

## 2. File Structure to Create

```
src/
├── modules/
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       ├── auth.service.spec.ts          # Vitest unit tests
│       ├── dto/
│       │   ├── register.dto.ts
│       │   ├── login.dto.ts
│       │   ├── refresh-token.dto.ts
│       │   └── change-password.dto.ts
│       ├── guards/
│       │   └── jwt-auth.guard.ts
│       ├── interfaces/
│       │   ├── jwt-payload.interface.ts
│       │   ├── auth-token-pair.interface.ts
│       │   └── session-summary.interface.ts
│       ├── strategies/
│       │   └── jwt.strategy.ts
│       └── utils/
│           └── duration.util.ts
├── database/
│   └── migrations/
│       └── <timestamp>-AddUserSessionAbsoluteExpiresAt.ts
└── common/
    ├── decorators/
    │   ├── current-user.decorator.ts     # @CurrentUser()
    │   └── roles.decorator.ts            # @Roles(...)
    └── guards/
        └── roles.guard.ts
```

---

## 3. Environment Variables

Add and validate these JWT settings in the Joi schema and ensure `.env` contains:

```env
JWT_SECRET=<at-least-32-character-random-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_SESSION_ABSOLUTE_EXPIRES_IN=30d
JWT_ISSUER=hq-management-api
JWT_AUDIENCE=hq-management-clients
THROTTLER_TTL=60000
THROTTLER_LIMIT=60
```

Update `src/config/env.validation.ts` to include these schema definitions:

```ts
export const envValidationSchema = Joi.object({
  // ... existing fields ...
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_SESSION_ABSOLUTE_EXPIRES_IN: Joi.string().default('30d'),
  JWT_ISSUER: Joi.string().default('hq-management-api'),
  JWT_AUDIENCE: Joi.string().default('hq-management-clients'),
  THROTTLER_TTL: Joi.number().default(60000),
  THROTTLER_LIMIT: Joi.number().default(60),
  // ...
});
```

Validate these values in `env.validation.ts`. `JWT_SECRET` must be a unique,
random production secret (at least 32 random bytes), never the example value.
Reject malformed or unsupported duration values at startup; never silently
substitute a fallback duration. Keep access-token lifetime short (15 minutes by
default), refresh idle lifetime 7 days, and absolute session lifetime 30 days.
The refresh idle expiry must never exceed the session's absolute expiry.
Validate that access-token TTL is shorter than refresh idle TTL, and that
refresh idle TTL is no longer than absolute session TTL.

---

## 4. Interfaces

### `JwtPayload` (`src/modules/auth/interfaces/jwt-payload.interface.ts`)

```ts
import { UserRole } from '../../../common/enums/user.enum.js';

export interface JwtPayload {
  sub: string; // User.id
  email: string;
  role: UserRole;
  sid: string; // UserSession.sessionId — used to validate / revoke per-session
  outletId: string | null;
  jti: string; // unique access-token ID
}
```

### `AuthTokenPair` (`src/modules/auth/interfaces/auth-token-pair.interface.ts`)

```ts
export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  tokenType: 'Bearer';
  expiresIn: number; // access-token lifetime in seconds (e.g. 900 for 15m)
}
```

### `SessionSummary` (`src/modules/auth/interfaces/session-summary.interface.ts`)

```ts
export interface SessionSummary {
  sessionId: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  issuedAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  isCurrent: boolean;
}
```

Sign using an explicitly configured algorithm (HS256 for the shared-secret
configuration), issuer, audience, `iat`, `exp`, and `jti`. The strategy must pin
the accepted algorithm and validate issuer/audience/expiration; do not accept
unsigned tokens or algorithms selected from untrusted token headers. The `sid`
claim is critical: on every protected request, look up the session and verify it
is active, belongs to `sub`, and has not passed either idle or absolute expiry.
Also load the current user and reject disabled users. Password, role, outlet, or
account-status changes must revoke that user's active sessions so stale access
tokens cannot retain old privileges.
Validate that `role` is a known `UserRole`, `sub`/`sid`/`jti` are non-empty
strings, and `outletId` is either null or a valid UUID before authorization.
Every user-management path that changes role, outlet assignment, or active
status must perform the corresponding session revocation in the same transaction.

---

## 5. DTOs

> [!IMPORTANT]
> All DTOs **must** use decorators from `class-validator` for input validation. Every decorator must be explicitly imported from `'class-validator'`. Do **not** rely on TypeScript types alone — they are erased at runtime.
>
> `class-transformer` enables `ValidationPipe` to instantiate the DTO class from the raw request body. Both packages work together and must both be installed (see Section 1).

### `RegisterDto` (`src/modules/auth/dto/register.dto.ts`)

```ts
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72) // bcrypt limit
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNo?: string;
}
```

### `LoginDto` (`src/modules/auth/dto/login.dto.ts`)

```ts
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt hard limit
  password: string;

  // Optional device metadata — forwarded to UserSession
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;
}
```

### `RefreshTokenDto` (`src/modules/auth/dto/refresh-token.dto.ts`)

```ts
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class RefreshTokenDto {
  @IsUUID()
  sessionId: string; // used to look up the session before comparing the token hash

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{43}$/, {
    message: 'refreshToken must be a 43-character base64url string',
  })
  refreshToken: string;
}
```

> [!NOTE]
> `sessionId` has been added to `RefreshTokenDto` (see Section 6 → `refresh()` method). The client must include both `sessionId` and `refreshToken` in the refresh request body. This avoids a costly full-table bcrypt scan across all active sessions.

### `ChangePasswordDto` (`src/modules/auth/dto/change-password.dto.ts`)

```ts
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  newPassword: string;
}
```

> [!IMPORTANT]
> **Password Byte Limit:** Registration and password-change DTOs enforce a minimum length of 12 characters and a maximum string length of 72. In addition, services must verify that `Buffer.byteLength(password, 'utf8') <= 72` so multi-byte UTF-8 sequences cannot exceed bcrypt's 72-byte ceiling.
>
> Ensure `ValidationPipe` is enabled globally in `main.ts`:
>
> ```ts
> app.useGlobalPipes(
>   new ValidationPipe({
>     whitelist: true,
>     transform: true,
>     forbidNonWhitelisted: true,
>   }),
> );
> ```

---

## 6. Auth Service (`src/modules/auth/auth.service.ts`)

Implement the following public methods. Use repositories for `User` and
`UserSession`. Inject `JwtService` and `ConfigService`.
Wrap multi-row auth state changes in TypeORM transactions. Log safe structured
events for failed authentication and session/password revocation; omit raw
credentials and tokens. Define a typed
`AuthTokenPair` response with exactly
`accessToken`, `refreshToken`, `sessionId`, `tokenType: 'Bearer'`, and
`expiresIn` (access lifetime in seconds); use safe DTOs for session-list responses.

### `register(dto: RegisterDto): Promise<void>`

1. Normalize the email by trimming whitespace and converting it to lowercase.
2. Reject a `fullName` that is empty after trimming and validate the password
   policy before any persistence operation.
3. Hash the password before branching on account existence so duplicate email
   does not skip the password-hashing cost.
4. Query by normalized email. If the email already exists, do not modify that
   account; return the same generic `202 Accepted` result as a new registration.
5. In one transaction, use the resulting hash to create an active user with the
   normalized email, trimmed `fullName`, optional `mobileNo`,
   `role: UserRole.OUTLET_STAFF`, and `outletId: null`.
6. Do not create a session or issue access/refresh tokens during registration.
   The user logs in separately after registration.
7. Do not accept or use client-supplied `role`, `outletId`, `isActive`, password
   hashes, or lockout/login fields. The global validation pipe must reject extra
   fields.
8. Handle database unique-email violations the same as an already-existing
   account. Catch only the known unique-constraint error; propagate unrelated
   persistence failures. Do not create duplicate users.
Registration response: `202 Accepted` with a generic message that is identical
for both new and existing email addresses. Never expose a generic `User` entity.

**File**: `src/modules/auth/dto/register.dto.ts`

```ts
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNo?: string;
}
```

### `login(dto: LoginDto, req: Request): Promise<AuthTokenPair>`

1. Normalize email. Query with `.addSelect('user.passwordHash')` because the
   column uses `select: false`.
2. Check account lock and active status, but return the same generic
   `UnauthorizedException('Invalid credentials')` response for unknown,
   incorrect-password, locked, and disabled accounts. Log only a safe reason
   code; never log the password, refresh token, or full credential payload.
3. For unknown, locked, or disabled accounts, compare against a
   fixed dummy bcrypt hash with the configured cost to reduce timing-based
   account enumeration.
4. On an incorrect password, increment `failedLoginAttempts` atomically in the
   database and use the updated count from that write to apply lockout. After 5
   consecutive failures, set `lockedUntil` to 15 minutes in
   the future. If a prior lock has expired, reset the stale counter before
   counting a new failure. Never reset on a failed login.
5. On success, reset `failedLoginAttempts` and `lockedUntil`, set `lastLoginAt`,
   and persist this user update in the same transaction as session/token creation.
   Counter updates must be safe under concurrent requests.
6. Extract IP and user agent on the server only. Never trust values supplied in
   the request body; trust `X-Forwarded-For` only behind configured trusted
   proxies. Treat device ID/name/type as descriptive metadata, not proof of
   device identity.
7. In one transaction, revoke the existing active session for the same
   user/device ID (when present), create a new `UserSession`, and set idle expiry
   from `JWT_REFRESH_EXPIRES_IN` and
   absolute expiry from `JWT_SESSION_ABSOLUTE_EXPIRES_IN`.
   Handle concurrent same-device logins against the existing unique index
   without creating two active sessions.
8. Generate a refresh token with `randomBytes(32).toString('base64url')`.
   Persist only `bcrypt.hash(refreshToken, 10)` in
   `UserSession.refreshTokenHash` in that transaction, then return the raw token
   once.
9. Build the JWT payload from the persisted user and session (`sub`, `email`,
   `role`, `sid`, `outletId`, and a fresh `jti` from `randomUUID()`). Sign with the configured access expiry,
   issuer, audience, and pinned algorithm.
10. Return `AuthTokenPair`: `accessToken`, `refreshToken`, `sessionId`,
    `tokenType: 'Bearer'`, and `expiresIn` (access-token lifetime). Never return
    hashes or the user's password fields.

### `refresh(dto: RefreshTokenDto): Promise<AuthTokenPair>`

1. Require `dto.sessionId` and a well-formed 32-byte base64url refresh token.
   Load only that session and explicitly select `refreshTokenHash` because the
   column uses `select: false`; never scan/hash-compare every active session.
2. Execute refresh in a database transaction and acquire a row lock on the
   session to serialize concurrent refresh attempts.
3. Reject missing, revoked, idle-expired, or absolutely expired sessions. For
   expired sessions, revoke the session and commit that revocation before
   returning the generic unauthorized response.
4. Compare the presented token against `session.refreshTokenHash`. If it does
   not match, reject with the same generic unauthorized response and do not
   revoke the session. Since only the current hash is stored, an old rotated
   token cannot be distinguished from an arbitrary invalid token; do not claim
   confirmed replay detection or revoke a session based only on a mismatch.
5. Verify the associated user is active inside the transaction.
6. Generate a new random refresh token and atomically replace
   `session.refreshTokenHash` with its bcrypt hash. Set the new token's expiry to
   `min(now + JWT_REFRESH_EXPIRES_IN, session.absoluteExpiresAt)` and update the
   session idle expiry in the same transaction.
7. Sign a new access JWT using the user's current role/outlet values and the
   existing session ID. Commit before returning the new raw refresh token. A
   failed transaction must never return a token that was not persisted.
8. Return the complete `AuthTokenPair`, including the unchanged `sessionId`.

### `logout(userId: string, sessionId: string): Promise<void>`

Revoke the current user's session atomically. The controller passes both the
authenticated `user.sub` and `user.sid`; service must verify session ownership.
Idempotent if already revoked.

### `logoutAll(userId: string): Promise<void>`

Atomically revoke every active session for the authenticated user. Derive
`userId` only from the verified JWT subject;
never accept it from the request body or path.

### `listSessions(userId: string, currentSessionId: string): Promise<SessionSummary[]>`

Return only the caller's sessions, newest first, with safe metadata
(`sessionId`, device metadata, `issuedAt`, `expiresAt`, and current-session
flag). Never return refresh-token hashes or raw credentials.

### `revokeSession(userId: string, sessionId: string): Promise<void>`

Revoke the specified session only if it belongs to `userId`. Return idempotent
success for missing or already-revoked
sessions so IDs cannot enumerate other users' devices.

### `validateSession(sessionId: string, userId: string): Promise<UserSession | null>`

Used by `JwtStrategy.validate()`. Accept both `sessionId` and token subject and
return an active session only if ownership, account state, idle expiry, absolute
expiry, and revocation checks pass; return `null` otherwise. This is the
single point of truth for token validity.

### `changePassword(userId: string, dto: ChangePasswordDto): Promise<void>`

Load the user's password hash explicitly; verify the current password, reject a
new password that matches the current password, hash the new password, update
`passwordChangedAt`, and revoke all active sessions in one transaction. Do not
return credentials. Require the user to log in again after changing the
password.

**Password policy:** Require at least 12 characters and enforce bcrypt's 72-byte
UTF-8 input limit without silent truncation. Apply the same policy to registration,
and password change. Reject passwords exceeding the byte limit.

---

## 7. JWT Strategy (`src/modules/auth/strategies/jwt.strategy.ts`)

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { AuthService } from '../auth.service.js';
import { UserRole } from '../../../common/enums/user.enum.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: config.getOrThrow<string>('JWT_ISSUER'),
      audience: config.getOrThrow<string>('JWT_AUDIENCE'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Reject malformed signed payloads before using claims for authorization.
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.jti !== 'string' ||
      !Object.values(UserRole).includes(payload.role) ||
      (payload.outletId !== null && typeof payload.outletId !== 'string')
    ) {
      throw new UnauthorizedException('Invalid access token');
    }
    const session = await this.authService.validateSession(
      payload.sid,
      payload.sub,
    );
    if (!session) {
      throw new UnauthorizedException('Session revoked or expired');
    }
    // Return the payload — it becomes req.user in guards/controllers
    return payload;
  }
}
```

---

## 8. Guards

### `JwtAuthGuard` (`src/modules/auth/guards/jwt-auth.guard.ts`)

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

The base `AuthGuard('jwt')` handles signature/claim validation, calls
`JwtStrategy.validate()`, and attaches its result to `req.user`.

### `RolesGuard` (`src/common/guards/roles.guard.ts`)

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user.enum.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload }>();
    if (!user) return false;
    return requiredRoles.includes(user.role);
  }
}
```

> [!IMPORTANT]
> `RolesGuard` must **always** be used together with `JwtAuthGuard` (apply `JwtAuthGuard` first). `RolesGuard` alone does **not** authenticate — it only authorizes an already-authenticated user.

---

## 9. Decorators (`src/common/decorators/`)

### `roles.decorator.ts`

```ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user.enum.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### `current-user.decorator.ts`

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
```

Only use `@CurrentUser()` on routes protected by `JwtAuthGuard`.

---

## 10. Auth Controller (`src/modules/auth/auth.controller.ts`)

```
POST  /api/v1/auth/register      → register(dto)                — public; generic 202
POST  /api/v1/auth/login         → login(dto, req)             — public
POST  /api/v1/auth/refresh        → refresh(dto)               — public
POST  /api/v1/auth/logout         → logout(user.sub, user.sid)  — JwtAuthGuard
POST  /api/v1/auth/logout/all     → logoutAll(user.sub)        — JwtAuthGuard
GET   /api/v1/auth/sessions       → listSessions(user.sub, user.sid) — JwtAuthGuard
DELETE /api/v1/auth/sessions/:id  → revokeSession(user.sub, id) — JwtAuthGuard
POST  /api/v1/auth/password/change → changePassword(user.sub)  — JwtAuthGuard
GET   /api/v1/auth/me             → returns current user info  — JwtAuthGuard
```

The registration handler must delegate to `AuthService.register()` and return a
generic **202 Accepted** response identical for new and existing email addresses.
It must not issue tokens, create a session, accept role/outlet assignments, or
allow an unauthenticated caller to create an administrator account.

**Controller notes:**

- Keep the controller thin and delegate metadata extraction and auth logic to the service. Never accept `ipAddress` or `userAgent` as client-controlled login DTO fields. Trust `X-Forwarded-For` only when Express is configured with known trusted proxies; otherwise use `req.ip`.
- Login and refresh responses must include `sessionId`, `tokenType: 'Bearer'`, and access-token lifetime so clients can associate refresh credentials with the right device. Never include token hashes or password fields.
- Return **202** for registration; **201** for login; **200** for refresh, logout, session listing/revocation, password change, and `me`.
- Set explicit `@HttpCode()` values for routes whose Nest defaults differ. Preserve the existing `ResponseInterceptor` envelope and assert both the HTTP status and token payload shape in e2e tests.

---

## 11. Auth Module (`src/modules/auth/auth.module.ts`)

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSession]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          expiresIn: parseDurationToSeconds(
            config.getOrThrow<string>('JWT_EXPIRES_IN'),
          ),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLER_TTL', 60000),
          limit: config.get<number>('THROTTLER_LIMIT', 60),
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

Then **import `AuthModule` into `AppModule`** (`import { AuthModule } from './modules/auth/auth.module.js'`).

Configure `JwtModule` with a typed duration helper; do not use `as any` to force
an invalid `expiresIn` type through TypeScript.
Register the shared-store rate limiter in the application configuration and
apply limits to registration, login, and refresh routes. Import and export
`RolesGuard` from `AuthModule` so
feature modules can resolve it alongside `JwtAuthGuard`.

---

## 12. Usage Examples (How to Protect Routes in Other Modules)

```ts
// Protect a route — any authenticated user
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@CurrentUser() user: JwtPayload) {
  return user;
}

// Protect a route — only HQ_ADMIN
@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HQ_ADMIN)
deleteUser(@Param('id') id: string) { ... }

// Protect a route — HQ_ADMIN or OUTLET_MANAGER
@Patch(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HQ_ADMIN, UserRole.OUTLET_MANAGER)
updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) { ... }
```

---

## 13. Unit Tests (`src/modules/auth/auth.service.spec.ts`) — Vitest

> [!IMPORTANT]
> This project uses **Vitest**, not Jest. Use `import { describe, it, expect, vi, beforeEach } from 'vitest'`. Do **not** use `jest.*` APIs.

Write tests covering:

| Scenario                      | Expected                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Successful registration       | Creates active `OUTLET_STAFF` with `outletId: null`; returns generic 202           |
| Duplicate registration email  | Same status/body as successful registration; no duplicate row                     |
| Registration password storage | Persists bcrypt hash; raw password is never persisted or returned                  |
| Registration privilege fields | Client cannot assign role, outlet, active state, or auth counters                  |
| Successful login              | Returns complete token pair and creates a per-device session                      |
| Unknown/disabled/locked user  | Same generic `UnauthorizedException`; dummy hash used when authentication is unavailable |
| Wrong password (< 5 attempts) | Increments `failedLoginAttempts`; throws `UnauthorizedException`                   |
| Wrong password (5th attempt)  | Sets `lockedUntil`; throws `UnauthorizedException`                                 |
| Expired login lock            | Resets stale counter before counting the next failure                              |
| Successful refresh            | Returns new token pair; stored session hash is rotated atomically                 |
| Parallel refresh requests     | Row locking/transaction permits only one rotation of the presented token           |
| Old or invalid refresh token   | Rejected generically without revoking the session                                  |
| Idle/absolute expired session | Rejected and session revoked                                                       |
| Same-device login             | Previous session for same user/device revoked; new session created                |
| Access-token session mismatch | Strategy rejects if session does not belong to JWT `sub`                          |
| Logout                        | Revokes only caller's session                                                     |
| Logout all                    | Revokes all sessions for caller                                                   |
| Revoke another user's session | No session changed; ownership information not disclosed                           |
| Password change               | Updates password hash and revokes all user sessions/tokens                        |
| Incorrect current password    | Password and sessions remain unchanged                                            |
| Same current/new password     | Rejected without changing password or sessions                                   |
| Rate limiting                 | Login, registration, and refresh endpoints enforce configured limits             |
| Guard behavior                | Missing JWT is 401; insufficient role is 403; protected RolesGuard denies no-user |

Add controller/e2e coverage for the actual `/api/v1/auth/*` routes, HTTP status
codes, global DTO validation, and guard composition. In particular, verify
registration rejects extra privilege fields and protected session-management
routes cannot operate on another user's data.
Validate `:id` route parameters as UUIDs (for example with `ParseUUIDPipe`).
Unit tests should mock repositories; do not make real network calls.

---

## 14. Security Checklist

- [ ] `passwordHash` column uses `select: false` — never returned in queries unless explicitly selected.
- [ ] Raw refresh-token secrets are never stored — only bcrypt hashes (`cost factor 10`).
- [ ] Refresh tokens are opaque, high-entropy credentials; every successful refresh rotates the hash stored on the session atomically.
- [ ] A mismatched refresh token is rejected without revoking the session; the system does not claim replay detection because prior hashes are not retained.
- [ ] Sessions have sliding idle expiry and fixed absolute expiry; refresh cannot extend beyond absolute expiry.
- [ ] Refresh, logout, logout-all, and password-change update session state transactionally.
- [ ] Logout and per-device revocation verify session ownership; logout-all derives identity from verified JWT claims.
- [ ] Same-device login handles the active-device unique index by revoking the prior session before insertion.
- [ ] Access tokens are short-lived (`15m`). Refresh tokens are long-lived (`7d`) but revocable.
- [ ] Account lockout after 5 consecutive failed attempts for 15 minutes; clear stale counters after an expired lock and on successful login.
- [ ] Login failures use one generic client response for unknown, wrong-password, locked, and disabled accounts; logs contain safe reason codes only.
- [ ] A dummy bcrypt hash is used for unknown-email login attempts to reduce timing-based enumeration.
- [ ] Failed-login counter updates are atomic under concurrent requests; lockout-window expiry and success reset behavior are defined.
- [ ] Login and registration endpoints are rate-limited by IP and normalized account identifier using a shared production store.
- [ ] `isActive` check on every login and refresh.
- [ ] Disabled accounts are rejected by `validateSession` on every protected request; authorization uses current, not stale, role/outlet state.
- [ ] Public registration always assigns `OUTLET_STAFF` and `outletId: null`; clients cannot grant themselves privileges or outlet access.
- [ ] Registration stores only a bcrypt password hash and returns no credential or session fields.
- [ ] Duplicate registration emails do not create duplicate accounts or produce a distinguishable public response.
- [ ] Password change revokes every active session.
- [ ] Current-password failure never updates the password or revokes sessions; successful password change rejects reuse of the current password.
- [ ] Password minimum and bcrypt byte-length limits are enforced consistently without silent truncation.
- [ ] Auth responses never expose stored hashes; raw refresh tokens are returned only where required for client use.
- [ ] JWT validation pins algorithm, issuer, and audience and validates expiry and required claims.
- [ ] Access JWTs are sent only in the `Authorization: Bearer` header; refresh tokens are sent only in HTTPS request bodies.
- [ ] Clients store refresh tokens in platform-appropriate secure storage; do not persist browser refresh tokens in `localStorage`. If cookie transport is introduced, use `HttpOnly`, `Secure`, `SameSite` cookies and explicit CSRF protection.
- [ ] Production auth traffic uses HTTPS; tokens and passwords are redacted from logs and telemetry.
- [ ] CORS for authenticated clients uses explicit trusted origins; do not combine wildcard origins with credentialed requests.
- [ ] `X-Forwarded-For` is trusted only behind explicitly configured trusted proxies.
- [ ] Session `expiresAt` validated on every refresh.
- [ ] `revokedAt` checked in `JwtStrategy.validate()` on every request — revoked sessions are rejected immediately even if the JWT has not yet expired.
- [ ] JWT subject, session owner, active account, role/outlet state, idle expiry, absolute expiry, and session revocation are checked before setting `req.user`.
- [ ] No sensitive fields (`passwordHash`, `refreshTokenHash`) in any API response.
- [ ] `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` enabled globally.

---

## 15. ESM Import Conventions

Since the project is `"type": "module"`, all relative imports **must** use the `.js` extension. Notice the path depth from `src/modules/auth/`:

```ts
// Inside src/modules/auth/...
import { AuthService } from './auth.service.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { User, UserSession } from '../../database/entities/index.js';

// Wrong — will fail at runtime
import { AuthService } from './auth.service';
```

---

Please implement **all files listed in Section 2** step-by-step, following this instruction exactly. Generate complete, production-ready TypeScript code for each file.
