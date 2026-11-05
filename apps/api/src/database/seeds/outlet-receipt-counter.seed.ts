import type { EntityManager } from 'typeorm';
import { Outlet } from '../entities/outlet.entity.js';
import { DEMO_SALES } from './sale.seed.js';

export async function seedOutletReceiptCounters(
  manager: EntityManager,
  outlets: Outlet[],
): Promise<void> {
  const minimumByOutlet = new Map<string, number>();
  for (const sale of DEMO_SALES) {
    minimumByOutlet.set(
      sale.outletCode,
      Math.max(minimumByOutlet.get(sale.outletCode) ?? 0, sale.receiptNo),
    );
  }

  for (const outlet of outlets) {
    const minimum = minimumByOutlet.get(outlet.code) ?? 0;
    await manager.query(
      'INSERT INTO "outlet_receipt_counters" ("outlet_id", "last_number") VALUES ($1, $2) ON CONFLICT ("outlet_id") DO UPDATE SET "last_number" = GREATEST("outlet_receipt_counters"."last_number", EXCLUDED."last_number")',
      [outlet.id, minimum],
    );
  }
}
