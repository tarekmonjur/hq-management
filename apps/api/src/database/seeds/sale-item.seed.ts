import type { EntityManager } from 'typeorm';
import { MenuItem } from '../entities/menu-item.entity.js';
import { Outlet } from '../entities/outlet.entity.js';
import { Sale } from '../entities/sale.entity.js';
import { SaleItem } from '../entities/sale-item.entity.js';
import { DEMO_SALES } from './sale.seed.js';

export async function seedSaleItems(manager: EntityManager): Promise<void> {
  const outlets = manager.getRepository(Outlet);
  const sales = manager.getRepository(Sale);
  const menuItems = manager.getRepository(MenuItem);
  const saleItems = manager.getRepository(SaleItem);

  for (const demoSale of DEMO_SALES) {
    const outlet = await outlets.findOneByOrFail({
      code: demoSale.outletCode,
    });
    const sale = await sales.findOneByOrFail({
      outletId: outlet.id,
      idempotencyKey: demoSale.idempotencyKey,
    });

    await saleItems.delete({ saleId: sale.id });
    const lines: SaleItem[] = [];
    for (const item of demoSale.items) {
      const menuItem = await menuItems.findOneByOrFail({
        name: item.menuItemName,
      });
      const lineTotal =
        (Math.round(item.unitPrice * 100) * item.quantity) / 100;

      lines.push(
        saleItems.create({
          saleId: sale.id,
          menuItemId: menuItem.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
        }),
      );
    }
    await saleItems.save(lines);
  }
}
