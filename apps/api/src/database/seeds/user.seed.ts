import bcrypt from 'bcrypt';
import type { EntityManager } from 'typeorm';
import { UserRole } from '../../common/enums/user.enum.js';
import { User } from '../entities/user.entity.js';
import type { Outlet } from '../entities/outlet.entity.js';

// ---------------------------------------------------------------------------
// Seed definitions — one entry per role
// ---------------------------------------------------------------------------

interface SeedUserDef {
  email: string;
  fullName: string;
  role: UserRole;
  /** Environment variable that supplies the password for this seed user. */
  passwordEnvVar: string;
  /** Fallback password used only in development (must satisfy ≥12 char rule). */
  defaultPassword: string;
  /**
   * Index into the outlets array passed to {@link seedUser}.
   * Undefined means the user is not tied to any outlet (e.g. HQ_ADMIN).
   */
  outletIndex?: number;
}

const SEED_USERS: SeedUserDef[] = [
  {
    email: 'admin@example.test',
    fullName: 'Demo HQ Administrator',
    role: UserRole.HQ_ADMIN,
    passwordEnvVar: 'SEED_HQ_ADMIN_PASSWORD',
    defaultPassword: 'Admin@123456',
    outletIndex: undefined,
  },
  {
    email: 'manager@example.test',
    fullName: 'Demo Outlet Manager',
    role: UserRole.OUTLET_MANAGER,
    passwordEnvVar: 'SEED_OUTLET_MANAGER_PASSWORD',
    defaultPassword: 'Manager@123456',
    outletIndex: 0,
  },
  {
    email: 'staff@example.test',
    fullName: 'Demo Outlet Staff',
    role: UserRole.OUTLET_STAFF,
    passwordEnvVar: 'SEED_OUTLET_STAFF_PASSWORD',
    defaultPassword: 'Staff@123456',
    outletIndex: 1,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolvePassword(def: SeedUserDef): string {
  const password = process.env[def.passwordEnvVar] || def.defaultPassword;

  if (!password) {
    throw new Error(
      `${def.passwordEnvVar} is required to create the seed user "${def.email}".`,
    );
  }
  if (password.length < 12) {
    throw new Error(
      `${def.passwordEnvVar} must be at least 12 characters long.`,
    );
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(
      `${def.passwordEnvVar} must not exceed 72 UTF-8 bytes for bcrypt.`,
    );
  }

  return password;
}

async function upsertSeedUser(
  manager: EntityManager,
  def: SeedUserDef,
  outlets: Outlet[],
  companyId: string,
): Promise<User> {
  const repo = manager.getRepository(User);
  const outletId =
    def.outletIndex !== undefined
      ? (outlets[def.outletIndex]?.id ?? null)
      : null;

  const existing = await repo.findOneBy({ email: def.email });

  if (existing) {
    existing.fullName = def.fullName;
    existing.role = def.role;
    existing.isActive = true;
    existing.outletId = outletId;
    existing.companyId = companyId;
    return repo.save(existing);
  }

  const password = resolvePassword(def);
  const passwordHash = await bcrypt.hash(password, 12);

  return repo.save(
    repo.create({
      email: def.email,
      fullName: def.fullName,
      role: def.role,
      passwordHash,
      outletId,
      companyId,
      isActive: true,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      lockedUntil: null,
    }),
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Seeds one user per {@link UserRole}:
 *  - HQ_ADMIN       → admin@example.test   (no outlet)
 *  - OUTLET_MANAGER → manager@example.test (Central Outlet — outlets[0])
 *  - OUTLET_STAFF   → staff@example.test   (Central Outlet — outlets[0])
 *
 * @param outlets - Seeded outlets from {@link seedOutlets}; used to assign
 *   outletId to outlet-scoped roles.
 *
 * Returns all three upserted users in the same order as {@link SEED_USERS}.
 */
export async function seedUser(
  manager: EntityManager,
  outlets: Outlet[],
  companyId: string,
): Promise<User[]> {
  return Promise.all(
    SEED_USERS.map((def) => upsertSeedUser(manager, def, outlets, companyId)),
  );
}
