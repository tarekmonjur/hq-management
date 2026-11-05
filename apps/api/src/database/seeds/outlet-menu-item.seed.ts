import type { EntityManager } from 'typeorm';
import { MenuItem } from '../entities/menu-item.entity.js';
import { Outlet } from '../entities/outlet.entity.js';
import { OutletMenuItem } from '../entities/outlet-menu-item.entity.js';
import { DEMO_MENU_ITEMS } from './menu-item.seed.js';

const AIRPORT_PRICE_OVERRIDES: Record<string, number> = {
  'Classic Burger': 9,
  'Chicken Sandwich': 12,
  'French Fries': 3.25,
  Coffee: 3.5,
};

export async function seedOutletMenuItems(
  manager: EntityManager,
  outlets: Outlet[],
  menuItems: MenuItem[],
): Promise<void> {
  const assignments = manager.getRepository(OutletMenuItem);
  const menuItemIds = new Map(menuItems.map((item) => [item.name, item.id]));

  const rows = outlets.flatMap((outlet) =>
    DEMO_MENU_ITEMS.map((menuItem) => {
      const menuItemId = menuItemIds.get(menuItem.name);
      if (!menuItemId) {
        throw new Error(`Seeded menu item not found: ${menuItem.name}`);
      }

      return {
        outletId: outlet.id,
        menuItemId,
        outletPrice:
          outlet.code === 'HQ-AIRPORT'
            ? AIRPORT_PRICE_OVERRIDES[menuItem.name]
            : menuItem.basePrice,
        isActive: true,
      };
    }),
  );

  await assignments.upsert(rows, ['outletId', 'menuItemId']);
}
