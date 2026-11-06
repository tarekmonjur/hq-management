import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateOutletMenuItemDto } from './create-outlet-menu-item.dto.js';
import { DeleteOutletMenuItemQueryDto } from './delete-outlet-menu-item-query.dto.js';
import { ListOutletMenuItemsQueryDto } from './list-outlet-menu-items-query.dto.js';
import { UpdateOutletMenuItemPriceDto } from './update-outlet-menu-item-price.dto.js';

const outletId = '123e4567-e89b-12d3-a456-426614174000';
const menuItemId = '123e4567-e89b-12d3-a456-426614174001';

describe('outlet menu item DTO validation', () => {
  it('accepts an assignment and transforms the outlet price', async () => {
    const dto = plainToInstance(CreateOutletMenuItemDto, {
      outletId,
      menuItemId,
      outletPrice: '250.50',
      isActive: false,
    });

    expect(dto.outletPrice).toBe(250.5);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a create body without the outlet and menu item', async () => {
    const dto = plainToInstance(CreateOutletMenuItemDto, {
      outletPrice: -1,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('requires an outlet and a non-negative price on update', async () => {
    const valid = plainToInstance(UpdateOutletMenuItemPriceDto, {
      outletId,
      outletPrice: '12.5',
    });
    const invalid = plainToInstance(UpdateOutletMenuItemPriceDto, {
      outletId,
      outletPrice: -0.01,
    });

    expect(valid.outletPrice).toBe(12.5);
    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });

  it('requires a uuid outlet id to remove an assignment', async () => {
    const valid = plainToInstance(DeleteOutletMenuItemQueryDto, { outletId });
    const invalid = plainToInstance(DeleteOutletMenuItemQueryDto, {
      outletId: 'outlet',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });

  it('transforms list search, boolean, and pagination filters', async () => {
    const dto = plainToInstance(ListOutletMenuItemsQueryDto, {
      page: '2',
      limit: '25',
      search: ' burger ',
      outletId,
      isActive: 'true',
    });

    expect(dto).toMatchObject({
      page: 2,
      limit: 25,
      search: 'burger',
      outletId,
      isActive: true,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);

    const invalid = plainToInstance(ListOutletMenuItemsQueryDto, {
      page: '0',
      limit: '101',
      isActive: 'yes',
    });
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
