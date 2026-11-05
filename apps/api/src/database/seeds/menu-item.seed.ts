import type { EntityManager } from 'typeorm';
import { MenuItem } from '../entities/menu-item.entity.js';

export const DEMO_MENU_ITEMS = [
  {
    name: 'Classic Burger',
    description: 'Beef patty, lettuce, tomato, and house sauce.',
    basePrice: 8.5,
    unit: 'piece',
  },
  {
    name: 'Chicken Sandwich',
    description: 'Grilled chicken sandwich with fresh greens.',
    basePrice: 11.5,
    unit: 'piece',
  },
  {
    name: 'French Fries',
    description: 'Crispy seasoned fries.',
    basePrice: 3,
    unit: 'piece',
  },
  {
    name: 'Coffee',
    description: 'Freshly brewed coffee.',
    basePrice: 3.25,
    unit: 'cup',
  },
] as const;

export async function seedMenuItems(
  manager: EntityManager,
): Promise<MenuItem[]> {
  const menuItems = manager.getRepository(MenuItem);

  await menuItems.upsert(
    DEMO_MENU_ITEMS.map((item) => ({
      ...item,
      unit: item.unit as MenuItem['unit'],
    })),
    ['name'],
  );

  const seededMenuItems: MenuItem[] = [];
  for (const { name } of DEMO_MENU_ITEMS) {
    seededMenuItems.push(await menuItems.findOneByOrFail({ name }));
  }
  return seededMenuItems;
}
