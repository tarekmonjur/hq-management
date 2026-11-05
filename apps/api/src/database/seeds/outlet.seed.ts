import type { EntityManager } from 'typeorm';
import { Outlet } from '../entities/outlet.entity.js';

export const DEMO_OUTLETS = [
  {
    code: 'HQ-CENTRAL',
    name: 'Central Outlet',
    location: 'Central District',
  },
  {
    code: 'HQ-AIRPORT',
    name: 'Airport Outlet',
    location: 'International Airport',
  },
] as const;

export async function seedOutlets(
  manager: EntityManager,
  companyId: string,
): Promise<Outlet[]> {
  const outlets = manager.getRepository(Outlet);

  await outlets.upsert(
    DEMO_OUTLETS.map((outlet) => ({ ...outlet, companyId })),
    ['code'],
  );

  const seededOutlets: Outlet[] = [];
  for (const { code } of DEMO_OUTLETS) {
    seededOutlets.push(await outlets.findOneByOrFail({ code }));
  }
  return seededOutlets;
}
