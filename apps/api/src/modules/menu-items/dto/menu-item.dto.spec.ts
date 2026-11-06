import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { MenuItemUnit } from '../../../common/enums/menu-item.enum.js';
import { CreateMenuItemDto } from './create-menu-item.dto.js';
import { ListMenuItemsQueryDto } from './list-menu-items-query.dto.js';
import { UpdateMenuItemDto } from './update-menu-item.dto.js';

describe('menu item DTO validation', () => {
  it('trims names and transforms numeric prices', async () => {
    const dto = plainToInstance(CreateMenuItemDto, {
      name: '  Chicken Burger  ',
      basePrice: '250.50',
      unit: MenuItemUnit.PIECE,
    });

    expect(dto.name).toBe('Chicken Burger');
    expect(dto.basePrice).toBe(250.5);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    { name: 'Price cannot be negative', basePrice: -0.01 },
    { name: 'Price cannot exceed column precision', basePrice: 100000000 },
    { name: 'Price cannot have more than two decimals', basePrice: 1.234 },
    { name: 'Price cannot be a boolean', basePrice: true },
    { name: 'Unit must be a declared enum value', unit: 'invalid-unit' },
  ])('rejects invalid input: $name', async ({ name: _name, ...values }) => {
    const dto = plainToInstance(CreateMenuItemDto, {
      name: 'Item',
      ...values,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('allows explicitly null nullable entity properties', async () => {
    const dto = plainToInstance(CreateMenuItemDto, {
      name: 'Item',
      description: null,
      basePrice: null,
      unit: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('allows omitted update fields but rejects a null name', async () => {
    const omitted = plainToInstance(UpdateMenuItemDto, {});
    const nullName = plainToInstance(UpdateMenuItemDto, { name: null });
    const nullable = plainToInstance(UpdateMenuItemDto, {
      description: null,
      basePrice: null,
      unit: null,
    });

    await expect(validate(omitted)).resolves.toHaveLength(0);
    await expect(validate(nullName)).resolves.not.toHaveLength(0);
    await expect(validate(nullable)).resolves.toHaveLength(0);
  });

  it('transforms and validates pagination query parameters', async () => {
    const dto = plainToInstance(ListMenuItemsQueryDto, {
      page: '2',
      limit: '25',
      search: ' burgers ',
    });

    expect(dto).toMatchObject({ page: 2, limit: 25, search: 'burgers' });
    await expect(validate(dto)).resolves.toHaveLength(0);

    const invalid = plainToInstance(ListMenuItemsQueryDto, {
      page: '0',
      limit: '101',
    });
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
