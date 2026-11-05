import type { EntityManager } from 'typeorm';
import { Outlet } from '../entities/outlet.entity.js';
import { Sale } from '../entities/sale.entity.js';

export interface DemoSaleItem {
  menuItemName: string;
  quantity: number;
  unitPrice: number;
}

export interface DemoSale {
  outletCode: string;
  receiptNo: number;
  idempotencyKey: string;
  items: DemoSaleItem[];
}

export const DEMO_SALES: DemoSale[] = [
  {
    outletCode: 'HQ-CENTRAL',
    receiptNo: 1,
    idempotencyKey: 'seed-demo-central-0001',
    items: [
      { menuItemName: 'Classic Burger', quantity: 1, unitPrice: 8.5 },
      { menuItemName: 'French Fries', quantity: 2, unitPrice: 3 },
    ],
  },
  {
    outletCode: 'HQ-CENTRAL',
    receiptNo: 2,
    idempotencyKey: 'seed-demo-central-0002',
    items: [
      { menuItemName: 'Coffee', quantity: 2, unitPrice: 3.25 },
      { menuItemName: 'Chicken Sandwich', quantity: 1, unitPrice: 11.5 },
    ],
  },
  {
    outletCode: 'HQ-AIRPORT',
    receiptNo: 1,
    idempotencyKey: 'seed-demo-airport-0001',
    items: [
      { menuItemName: 'Classic Burger', quantity: 2, unitPrice: 9 },
      { menuItemName: 'Coffee', quantity: 1, unitPrice: 3.5 },
    ],
  },
  {
    outletCode: 'HQ-AIRPORT',
    receiptNo: 2,
    idempotencyKey: 'seed-demo-airport-0002',
    items: [
      { menuItemName: 'Chicken Sandwich', quantity: 1, unitPrice: 12 },
      { menuItemName: 'French Fries', quantity: 1, unitPrice: 3.25 },
    ],
  },
];

export async function seedSales(manager: EntityManager): Promise<void> {
  const outlets = manager.getRepository(Outlet);
  const sales = manager.getRepository(Sale);

  for (const demoSale of DEMO_SALES) {
    const outlet = await outlets.findOneByOrFail({
      code: demoSale.outletCode,
    });
    const totalInMinorUnits = demoSale.items.reduce(
      (total, item) => total + Math.round(item.unitPrice * 100) * item.quantity,
      0,
    );

    await sales.upsert(
      {
        outletId: outlet.id,
        receiptNo: demoSale.receiptNo,
        total: totalInMinorUnits / 100,
        idempotencyKey: demoSale.idempotencyKey,
      },
      ['outletId', 'idempotencyKey'],
    );
  }
}
