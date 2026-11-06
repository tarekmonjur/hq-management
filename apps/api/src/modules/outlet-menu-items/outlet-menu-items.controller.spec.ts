import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateOutletMenuItemDto } from './dto/create-outlet-menu-item.dto.js';
import { DeleteOutletMenuItemQueryDto } from './dto/delete-outlet-menu-item-query.dto.js';
import { ListOutletMenuItemsQueryDto } from './dto/list-outlet-menu-items-query.dto.js';
import { UpdateOutletMenuItemPriceDto } from './dto/update-outlet-menu-item-price.dto.js';
import { OutletMenuItemsController } from './outlet-menu-items.controller.js';
import { OutletMenuItemsService } from './outlet-menu-items.service.js';

describe('OutletMenuItemsController', () => {
  const service = {
    create: vi.fn(),
    findAll: vi.fn(),
    updatePrice: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new OutletMenuItemsController(
    service as unknown as OutletMenuItemsService,
  );
  const user = { sub: 'user-id' } as JwtPayload;

  it('delegates assign, list, price update, and removal', () => {
    const createDto = { outletId: 'outlet-id' } as CreateOutletMenuItemDto;
    const query = { page: 1, limit: 20 } as ListOutletMenuItemsQueryDto;
    const priceDto = { outletId: 'outlet-id', outletPrice: 10 } as UpdateOutletMenuItemPriceDto;
    const deleteQuery = { outletId: 'outlet-id' } as DeleteOutletMenuItemQueryDto;
    service.create.mockReturnValue({ id: 'assignment-id' });
    service.findAll.mockReturnValue({ items: [], total: 0 });
    service.updatePrice.mockReturnValue({ outletPrice: 10 });
    service.remove.mockReturnValue({
      message: 'Outlet menu assignment removed successfully',
    });

    expect(controller.create(user, createDto)).toEqual({ id: 'assignment-id' });
    expect(controller.findAll(user, query)).toEqual({ items: [], total: 0 });
    expect(controller.updatePrice(user, 'menu-item-id', priceDto)).toEqual({
      outletPrice: 10,
    });
    expect(controller.remove(user, 'menu-item-id', deleteQuery)).toEqual({
      message: 'Outlet menu assignment removed successfully',
    });
    expect(service.create).toHaveBeenCalledWith('user-id', createDto);
    expect(service.findAll).toHaveBeenCalledWith('user-id', query);
    expect(service.updatePrice).toHaveBeenCalledWith(
      'user-id',
      'menu-item-id',
      priceDto,
    );
    expect(service.remove).toHaveBeenCalledWith(
      'user-id',
      'menu-item-id',
      'outlet-id',
    );
  });

  it('lets every signed-in role list and limits writes to HQ or super admin', () => {
    const adminRoles = [UserRole.HQ_ADMIN, UserRole.SUPER_ADMIN];
    expect(
      Reflect.getMetadata(ROLES_KEY, OutletMenuItemsController.prototype.findAll),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, OutletMenuItemsController.prototype.create),
    ).toEqual(adminRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        OutletMenuItemsController.prototype.updatePrice,
      ),
    ).toEqual(adminRoles);
    expect(
      Reflect.getMetadata(ROLES_KEY, OutletMenuItemsController.prototype.remove),
    ).toEqual(adminRoles);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, OutletMenuItemsController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
  });
});
