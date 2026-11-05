import type { EntityManager } from 'typeorm';
import { Company } from '../entities/company.entity.js';

export const DEMO_COMPANY_NAME = 'HQ Management Demo';

export async function seedCompany(manager: EntityManager): Promise<Company> {
  const companies = manager.getRepository(Company);

  await companies.upsert({ name: DEMO_COMPANY_NAME }, ['name']);

  return companies.findOneByOrFail({ name: DEMO_COMPANY_NAME });
}
