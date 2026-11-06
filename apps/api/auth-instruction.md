Role: Senior Software Engineer

## Project Context

You are implementing a JWT-based authentication and authorization module in an **existing NestJS 12 backend** with the following confirmed project characteristics:

- **Package manager / runtime**: Node.js ESM (`"type": "module"` in `package.json`) — all local imports **must** use `.js` extensions even for `.ts` source files.
- **API prefix + URI versioning**: Global prefix `api`, URI versioning default version `'1'`. All endpoints are therefore served at `/api/v1/...`.
- **Test runner**: **Vitest** (NOT Jest). All test files use `vitest` imports (`describe`, `it`, `expect`, `vi` from `'vitest'`).
- **Env validation**: Joi schema lives in `src/config/env.validation.ts`. JWT env vars are **already declared**: `JWT_SECRET` (min 32 chars), `JWT_EXPIRES_IN` (default `'15m'`), `JWT_REFRESH_EXPIRES_IN` (default `'7d'`).
- **Logging**: `nestjs-pino` / `pino-http` is already wired into `AppModule`. Inject `Logger` from `'nestjs-pino'` for structured logging inside services.
- **ORM**: TypeORM with PostgreSQL. `synchronize: false`. Migrations are managed manually.

## Existing Entities (Do Not Modify)

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
| `isActive`            | `boolean` default true    | must check on login — throw `UnauthorizedException` if false                    |
| `passwordChangedAt`   | `timestamp` nullable      |                                                                                 |
| `lastLoginAt`         | `timestamptz` nullable    | update on successful login                                                      |
| `failedLoginAttempts` | `int` default 0           | brute-force counter                                                             |
| `lockedUntil`         | `timestamptz` nullable    | account lockout — check before validating password                              |
| `sessions`            | `OneToMany → UserSession` |                                                                                 |

### `UserSession` (`src/database/entities/user-session.entity.ts`)

Tracks each device/client session independently, enabling multi-device login and per-session revocation.

| Field              | Type                    | Notes                                              |
| ------------------ | ----------------------- | -------------------------------------------------- |
| `sessionId`        | `uuid` PK               | embed in JWT payload as `sid` claim                |
| `userId`           | `uuid` FK               |                                                    |
| `refreshTokenHash` | `varchar(255)`          | bcrypt hash of the raw refresh token               |
| `deviceId`         | `varchar(100)` nullable | client-supplied opaque device identifier           |
| `deviceName`       | `varchar(100)` nullable | e.g. `"iPhone 15 Pro"`                             |
| `deviceType`       | `varchar(50)` nullable  | e.g. `"mobile"`, `"desktop"`, `"api"`              |
| `os`               | `varchar(100)` nullable |                                                    |
| `browser`          | `varchar(100)` nullable |                                                    |
| `ipAddress`        | `inet` nullable         |                                                    |
| `userAgent`        | `text` nullable         |                                                    |
| `issuedAt`         | `timestamp`             |                                                    |
| `expiresAt`        | `timestamp`             | refresh token expiry — enforce in refresh endpoint |
| `revokedAt`        | `timestamp` nullable    | null = active; non-null = revoked                  |

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
2. Register users with email, password, and profile details through `POST /auth/register`.
3. Issue short-lived **access tokens** (JWT) and long-lived **refresh tokens** on login.
4. Support **multi-device login** — each login creates a new `UserSession` row.
5. Allow **per-session token refresh** (`POST /auth/refresh`).
6. Allow **per-session logout/revoke** (`POST /auth/logout`) and **revoke-all-sessions** (`POST /auth/logout/all`).
7. Guard routes with `JwtAuthGuard` (authentication) and `RolesGuard` (authorization).
8. Protect against brute-force via `failedLoginAttempts` / `lockedUntil`.

Public registration creates an active `OUTLET_STAFF` account with no outlet assigned.
The client must not choose a role or `outletId`; those fields are controlled by
trusted administrative workflows. Registration creates the account only and does
not issue tokens or create a session; the user logs in separately.

---

## 1. Install Missing Dependencies

The following packages are **not yet in `package.json`** and must be installed:

```bash
# JWT & Passport
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install -D @types/passport-jwt

# DTO validation — required for class-validator decorators to work
npm install class-validator class-transformer
```

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
│       │   └── refresh-token.dto.ts
│       ├── guards/
│       │   └── jwt-auth.guard.ts
│       ├── interfaces/
│       │   └── jwt-payload.interface.ts
│       └── strategies/
│           └── jwt.strategy.ts
└── common/
    ├── decorators/
    │   ├── current-user.decorator.ts  # @CurrentUser()
    │   └── roles.decorator.ts         # @Roles(...)
    └── guards/
        └── roles.guard.ts
```

---

## 3. Environment Variables

These are already declared in the Joi schema. Ensure `.env` contains:

```env
JWT_SECRET=<at-least-32-character-random-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

## 4. JWT Payload Interface

**File**: `src/modules/auth/interfaces/jwt-payload.interface.ts`

```ts
export interface JwtPayload {
  sub: string; // User.id
  email: string;
  role: UserRole;
  sid: string; // UserSession.sessionId — used to validate / revoke per-session
  outletId: string | null;
}
```

The `sid` claim is critical: on every protected request the strategy **looks up the session** and verifies `revokedAt IS NULL` and `expiresAt > NOW()`.

---

## 5. DTOs

> [!IMPORTANT]
> All DTOs **must** use decorators from `class-validator` for input validation. Every decorator must be explicitly imported from `'class-validator'`. Do **not** rely on TypeScript types alone — they are erased at runtime.
>
> `class-transformer` enables `ValidationPipe` to instantiate the DTO class from the raw request body. Both packages work together and must both be installed (see Section 1).

**File**: `src/modules/auth/dto/login.dto.ts`

```ts
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
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

**File**: `src/modules/auth/dto/refresh-token.dto.ts`

```ts
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @IsUUID()
  sessionId: string; // used to look up the session before comparing the token hash

  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

> [!NOTE]
> `sessionId` has been added to `RefreshTokenDto` (see Section 6 → `refresh()` method). The client must include both `sessionId` and `refreshToken` in the refresh request body. This avoids a costly full-table bcrypt scan across all active sessions.

> [!IMPORTANT]
> Enable `ValidationPipe` globally in `main.ts` — it is currently **commented out**. Uncomment and configure it:
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
>
> Also add `import { ValidationPipe } from '@nestjs/common';` to `main.ts`.
>
> The `transform: true` option is what tells NestJS to use `class-transformer` to convert the raw JSON body into an instance of the DTO class, which is required for `class-validator` decorators to execute.

---

## 6. Auth Service (`src/modules/auth/auth.service.ts`)

Implement the following public methods. Use `InjectRepository(User)` and `InjectRepository(UserSession)` for data access. Inject `JwtService` from `@nestjs/jwt` and `ConfigService`.

### `register(dto: RegisterDto): Promise<RegisteredUser>`

1. Normalize the email by trimming whitespace and converting it to lowercase.
2. Check for an existing user with that normalized email. If one exists, throw
   `ConflictException('Email is already registered')`.
3. Reject a `fullName` that is empty after trimming.
4. Hash the password with `bcrypt.hash(dto.password, 10)`; never store the raw password.
5. Create an active user with the normalized email, trimmed `fullName`, optional
   `mobileNo`, `role: UserRole.OUTLET_STAFF`, and `outletId: null`.
6. Do not accept or use client-supplied `role`, `outletId`, `isActive`, password
   hashes, or lockout/login fields. The global validation pipe must reject extra
   fields.
7. Save and return only the safe public fields: `id`, `email`, `fullName`,
   `mobileNo`, `role`, and `outletId`. Never return `passwordHash` or session data.
8. Do not create a session or issue access/refresh tokens during registration.
   The client must call `POST /auth/login` after registration.

Define `RegisteredUser` as a type containing exactly the safe response fields above.
Do not expose a generic `User` entity as the endpoint response.

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
  @MinLength(8)
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

### `login(dto: LoginDto, req: Request): Promise<{ accessToken; refreshToken }>`

1. Find user by `email` using `.addSelect('user.passwordHash')` (required because `select: false`).
2. If user not found → throw `UnauthorizedException('Invalid credentials')`.
3. If `user.lockedUntil` is in the future → throw `UnauthorizedException('Account temporarily locked')`.
4. If `!user.isActive` → throw `UnauthorizedException('Account is disabled')`.
5. Compare password with `bcrypt.compare(password, user.passwordHash)`.
6. If password invalid → **increment `failedLoginAttempts`**; if count ≥ 5 → set `lockedUntil = now + 15 minutes`; save; throw `UnauthorizedException('Invalid credentials')`.
7. On success → **reset `failedLoginAttempts = 0`**, set `lastLoginAt = new Date()`, save.
8. Generate a cryptographically random raw refresh token (`crypto.randomBytes(64).toString('hex')`).
9. Hash the refresh token with `bcrypt.hash(rawRefreshToken, 10)`.
10. Compute `expiresAt` from `JWT_REFRESH_EXPIRES_IN` env var.
11. Create and save a new `UserSession` row (populate `deviceId`, `deviceName`, `deviceType`, `ipAddress`, `userAgent` from `dto` and `req`).
12. Build `JwtPayload` with `sub`, `email`, `role`, `sid` (the new `sessionId`), `outletId`.
13. Sign and return `accessToken` (via `jwtService.sign(payload)`) and raw `refreshToken`.

### `refresh(dto: RefreshTokenDto): Promise<{ accessToken; refreshToken }>`

1. The raw refresh token contains no verifiable signature on its own — look up all non-revoked sessions and compare with `bcrypt.compare`. **For performance**, require the client to also send `sessionId` (add an optional field to `RefreshTokenDto`) or decode the access token to get `sid`. Recommended: add `sessionId` to `RefreshTokenDto`.
2. Load session by `sessionId` where `revokedAt IS NULL`.
3. If not found → throw `UnauthorizedException('Session not found or revoked')`.
4. If `session.expiresAt < new Date()` → mark `revokedAt`, save, throw `UnauthorizedException('Refresh token expired')`.
5. Verify `bcrypt.compare(dto.refreshToken, session.refreshTokenHash)` → if false → throw `UnauthorizedException`.
6. Load the associated user; check `isActive`.
7. **Rotate the refresh token**: generate a new raw token, hash it, update `session.refreshTokenHash` and `session.expiresAt`, save.
8. Sign a new access token and return both tokens.

### `logout(sessionId: string): Promise<void>`

Mark session `revokedAt = new Date()` and save. Idempotent if already revoked.

### `logoutAll(userId: string): Promise<void>`

Bulk-update all active sessions for the user: `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`.

### `validateSession(sessionId: string): Promise<UserSession | null>`

Used by `JwtStrategy.validate()`. Returns the session if active and not expired; returns `null` otherwise. This is the **single point of truth** for token validity.

---

## 7. JWT Strategy (`src/modules/auth/strategies/jwt.strategy.ts`)

```ts
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
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const session = await this.authService.validateSession(payload.sid);
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

- add proper jwt aut gruad

Simple extension. The base `AuthGuard('jwt')` handles invoking `JwtStrategy.validate()` and attaching the result to `req.user`.

### `RolesGuard` (`src/common/guards/roles.guard.ts`)

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
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
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### `current-user.decorator.ts`

- add a proper current user decorator

---

## 10. Auth Controller (`src/modules/auth/auth.controller.ts`)

```
POST  /api/v1/auth/register      → register(dto)                — public; returns 201
POST  /api/v1/auth/login         → login(dto, req)             — public
POST  /api/v1/auth/refresh        → refresh(dto)               — public
POST  /api/v1/auth/logout         → logout(user.sid)           — JwtAuthGuard
POST  /api/v1/auth/logout/all     → logoutAll(user.sub)        — JwtAuthGuard
GET   /api/v1/auth/me             → returns current user info  — JwtAuthGuard
```

The registration handler must delegate to `AuthService.register()` and return its
safe `RegisteredUser` result with HTTP **201 Created**. It must not issue tokens,
create a session, accept role/outlet assignments, or allow an unauthenticated
caller to create an administrator account.

**Controller notes:**

- Extract `ipAddress` from `req.ip` (or `X-Forwarded-For` header) and `userAgent` from `req.headers['user-agent']` for session creation.
- The controller should be thin — delegate all logic to `AuthService`.
- Return **201** for `register` (account created) and `login` (new session created); return **200** for `refresh` and `me`.

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
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard], // export JwtModule & JwtAuthGuard so other modules can use them
})
export class AuthModule {}
```

Then **import `AuthModule` into `AppModule`** (`import { AuthModule } from './modules/auth/auth.module.js'`).

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
| Successful registration       | Creates active `OUTLET_STAFF` with `outletId: null`; returns safe user fields only |
| Duplicate registration email  | Throws `ConflictException`; does not create another user                           |
| Registration password storage | Persists bcrypt hash; raw password is never persisted or returned                  |
| Registration privilege fields | Client cannot assign role, outlet, active state, or auth counters                  |
| Successful login              | Returns `accessToken` and `refreshToken`; session created                          |
| User not found                | Throws `UnauthorizedException('Invalid credentials')`                              |
| Wrong password (< 5 attempts) | Increments `failedLoginAttempts`; throws `UnauthorizedException`                   |
| Wrong password (5th attempt)  | Sets `lockedUntil`; throws `UnauthorizedException`                                 |
| Locked account                | Throws `UnauthorizedException('Account temporarily locked')`                       |
| Inactive account              | Throws `UnauthorizedException('Account is disabled')`                              |
| Successful refresh            | Returns new token pair; session `refreshTokenHash` updated                         |
| Expired refresh session       | Throws `UnauthorizedException('Refresh token expired')`                            |
| Revoked session in strategy   | `validateSession` returns null; guard throws `UnauthorizedException`               |
| Logout                        | Sets `revokedAt` on session                                                        |
| Logout all                    | Revokes all active sessions for user                                               |

---

## 14. Security Checklist

- [ ] `passwordHash` column uses `select: false` — never returned in queries unless explicitly selected.
- [ ] Raw refresh tokens are never stored — only bcrypt hashes (`cost factor 10`).
- [ ] Access tokens are short-lived (`15m`). Refresh tokens are long-lived (`7d`) but revocable.
- [ ] Account lockout after 5 failed attempts (15-minute window).
- [ ] `isActive` check on every login and refresh.
- [ ] Public registration always assigns `OUTLET_STAFF` and `outletId: null`; clients cannot grant themselves privileges or outlet access.
- [ ] Registration stores only a bcrypt password hash and returns no credential or session fields.
- [ ] Duplicate registration emails fail without creating duplicate accounts.
- [ ] Session `expiresAt` validated on every refresh.
- [ ] `revokedAt` checked in `JwtStrategy.validate()` on every request — revoked sessions are rejected immediately even if the JWT has not yet expired.
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
