import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MenuItem } from '../../database/entities/menu-item.entity.js';
import { MenuItemUnit } from '../../common/enums/menu-item.enum.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto.js';
import { MenuItemsService } from './menu-items.service.js';

describe('MenuItemsService', () => {
  let service: MenuItemsService;
  let repository: Pick<
    Repository<MenuItem>,
    'create' | 'save' | 'findAndCount' | 'findOneBy' | 'remove'
  >;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      save: vi.fn(),
      findAndCount: vi.fn(),
      findOneBy: vi.fn(),
      remove: vi.fn(),
    };
    service = new MenuItemsService(repository as Repository<MenuItem>);
  });

  it('creates a menu item and maps the known unique-name constraint to 409', async () => {
    const dto = {
      name: 'Chicken Burger',
      basePrice: 250,
      unit: MenuItemUnit.PIECE,
    } as CreateMenuItemDto;
    const item = {
      id: 'item-id',
      name: dto.name,
      basePrice: dto.basePrice ?? null,
      unit: dto.unit ?? null,
    } as MenuItem;
    const driverError = Object.assign(new Error('duplicate name'), {
      code: '23505',
      constraint: 'uq_menu_items_name',
    });

    vi.mocked(repository.create).mockReturnValue(item);
    vi.mocked(repository.save).mockRejectedValue(
      new QueryFailedError('insert', [], driverError),
    );

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).toHaveBeenCalledWith(dto);
  });

  it('returns a page of menu items and total count', async () => {
    const items = [{ id: 'item-id', name: 'Chicken Burger' }] as MenuItem[];
    const query = {
      page: 2,
      limit: 10,
      search: 'burger',
    } as ListMenuItemsQueryDto;
    vi.mocked(repository.findAndCount).mockResolvedValue([items, 21]);

    await expect(service.findAll(query)).resolves.toEqual({
      items,
      total: 21,
      page: 2,
      limit: 10,
    });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        order: { name: 'ASC' },
        where: { name: expect.anything() },
      }),
    );
  });

  it('throws not found when the requested item does not exist', async () => {
    vi.mocked(repository.findOneBy).mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates an existing menu item', async () => {
    const item = { id: 'item-id', name: 'Old name' } as MenuItem;
    vi.mocked(repository.findOneBy).mockResolvedValue(item);
    vi.mocked(repository.save).mockImplementation(
      async (saved) => saved as MenuItem,
    );

    await expect(
      service.update('item-id', { name: 'New name' }),
    ).resolves.toMatchObject({ id: 'item-id', name: 'New name' });
  });

  it('refuses to delete an item referenced by other records', async () => {
    const item = { id: 'item-id', name: 'Chicken Burger' } as MenuItem;
    const driverError = Object.assign(new Error('foreign key violation'), {
      code: '23503',
      constraint: 'fk_sale_item_menu_item',
    });
    vi.mocked(repository.findOneBy).mockResolvedValue(item);
    vi.mocked(repository.remove).mockRejectedValue(
      new QueryFailedError('delete', [], driverError),
    );

    await expect(service.remove('item-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
