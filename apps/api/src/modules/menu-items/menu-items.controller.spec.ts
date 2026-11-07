import { describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto.js';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';
import { MenuItemsController } from './menu-items.controller.js';
import { MenuItemsService } from './menu-items.service.js';

describe('MenuItemsController', () => {
  const service = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new MenuItemsController(
    service as unknown as MenuItemsService,
  );

  it('delegates create, list, and get requests to the service', () => {
    const createDto = { name: 'Tea' } as CreateMenuItemDto;
    const listQuery = { page: 1, limit: 20 } as ListMenuItemsQueryDto;
    service.create.mockReturnValue({ id: 'item-id' });
    service.findAll.mockReturnValue({ items: [], total: 0 });
    service.findOne.mockReturnValue({ id: 'item-id' });

    expect(controller.create(createDto)).toEqual({ id: 'item-id' });
    expect(controller.findAll(listQuery)).toEqual({ items: [], total: 0 });
    expect(controller.findOne('item-id')).toEqual({ id: 'item-id' });
    expect(service.create).toHaveBeenCalledWith(createDto);
    expect(service.findAll).toHaveBeenCalledWith(listQuery);
    expect(service.findOne).toHaveBeenCalledWith('item-id');
  });

  it('delegates update and delete requests to the service', () => {
    const updateDto = { name: 'Updated Tea' } as UpdateMenuItemDto;
    service.update.mockReturnValue({ id: 'item-id', name: 'Updated Tea' });
    service.remove.mockReturnValue({
      message: 'Menu item deleted successfully',
    });

    expect(controller.update('item-id', updateDto)).toEqual({
      id: 'item-id',
      name: 'Updated Tea',
    });
    expect(controller.remove('item-id')).toEqual({
      message: 'Menu item deleted successfully',
    });
    expect(service.update).toHaveBeenCalledWith('item-id', updateDto);
    expect(service.remove).toHaveBeenCalledWith('item-id');
  });

  it('restricts the entire controller to HQ and super admins', () => {
    expect(Reflect.getMetadata(ROLES_KEY, MenuItemsController)).toEqual([
      UserRole.HQ_ADMIN,
      UserRole.SUPER_ADMIN,
    ]);
  });
});
