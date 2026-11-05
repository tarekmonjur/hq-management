import type { EntityManager } from 'typeorm';
import { Inventory } from '../entities/inventory.entity.js';
import { MenuItem } from '../entities/menu-item.entity.js';
import { Outlet } from '../entities/outlet.entity.js';

const DEMO_STOCK: Record<string, Record<string, number>> = {
  'HQ-CENTRAL': {
    'Classic Burger': 24,
    'Chicken Sandwich': 15,
    'French Fries': 40,
    Coffee: 50,
  },
  'HQ-AIRPORT': {
    'Classic Burger': 18,
    'Chicken Sandwich': 12,
    'French Fries': 35,
    Coffee: 45,
  },
};

export async function seedInventories(
  manager: EntityManager,
  outlets: Outlet[],
  menuItems: MenuItem[],
): Promise<void> {
  const inventories = manager.getRepository(Inventory);
  const rows = outlets.flatMap((outlet) =>
    menuItems.map((menuItem) => {
      const quantity = DEMO_STOCK[outlet.code]?.[menuItem.name];
      if (quantity === undefined) {
        throw new Error(
          `Missing demo stock quantity for ${outlet.code}/${menuItem.name}`,
        );
      }

      return {
        outletId: outlet.id,
        menuItemId: menuItem.id,
        quantity,
      };
    }),
  );

  await inventories
    .createQueryBuilder()
    .insert()
    .values(rows)
    .orIgnore()
    .execute();
}
