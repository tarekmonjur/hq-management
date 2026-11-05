import 'reflect-metadata';
import { AppDataSource } from '../data-source.js';
import { seedCompany } from './company.seed.js';
import { seedInventories } from './inventory.seed.js';
import { seedMenuItems } from './menu-item.seed.js';
import { seedOutletMenuItems } from './outlet-menu-item.seed.js';
import { seedOutlets } from './outlet.seed.js';
import { seedOutletReceiptCounters } from './outlet-receipt-counter.seed.js';
import { seedSaleItems } from './sale-item.seed.js';
import { seedSales } from './sale.seed.js';
import { seedUser } from './user.seed.js';

async function runSeeds(): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Demo database seeds cannot run in production.');
    }

    await AppDataSource.initialize();
    await AppDataSource.transaction(async (manager) => {
      const company = await seedCompany(manager);
      const outlets = await seedOutlets(manager, company.id);
      const menuItems = await seedMenuItems(manager);

      await seedOutletMenuItems(manager, outlets, menuItems);
      await seedInventories(manager, outlets, menuItems);
      await seedOutletReceiptCounters(manager, outlets);
      await seedUser(manager, outlets);
      await seedSales(manager);
      await seedSaleItems(manager);
    });

    console.info('Database seed completed successfully.');
    console.info('Seeded users:');
    console.info('  HQ Admin       → admin@example.test');
    console.info('  Outlet Manager → manager@example.test (Central Outlet)');
    console.info('  Outlet Staff   → staff@example.test   (Central Outlet)');
    console.info(
      'UserSession rows are intentionally not seeded; sessions represent live authentication state.',
    );
  } catch (error) {
    console.error('Database seeding failed.', error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

await runSeeds();
