import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';
import { ListInventoriesQueryDto } from './dto/list-inventories-query.dto.js';
import { InventoriesController } from './inventories.controller.js';
import { InventoriesService } from './inventories.service.js';

describe('InventoriesController', () => {
  const service = {
    findAll: vi.fn(),
    adjustStock: vi.fn(),
  };
  const controller = new InventoriesController(
    service as unknown as InventoriesService,
  );
  const user = { sub: 'user-id' } as JwtPayload;

  it('delegates findAll to the service with the user subject and query', () => {
    const query = { page: 1, limit: 20 } as ListInventoriesQueryDto;
    const result = { items: [], total: 0, page: 1, limit: 20 };
    service.findAll.mockReturnValue(result);

    expect(controller.findAll(user, query)).toEqual(result);
    expect(service.findAll).toHaveBeenCalledWith('user-id', query);
  });

  it('delegates adjustStock to the service with the user subject, inventoryId, and dto', () => {
    const dto = { quantity: 50 } as AdjustInventoryDto;
    const result = { id: 'inventory-id', quantity: 50 };
    service.adjustStock.mockReturnValue(result);

    expect(controller.adjustStock(user, 'inventory-id', dto)).toEqual(result);
    expect(service.adjustStock).toHaveBeenCalledWith(
      'user-id',
      'inventory-id',
      dto,
    );
  });

  it('applies JwtAuthGuard and RolesGuard at the class level', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, InventoriesController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('allows all four roles on GET /inventories', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.findAll)).toEqual([
      UserRole.HQ_ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.OUTLET_MANAGER,
      UserRole.OUTLET_STAFF,
    ]);
  });

  it('restricts PUT /inventories/:inventoryId to admin roles only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.adjustStock)).toEqual([
      UserRole.HQ_ADMIN,
      UserRole.SUPER_ADMIN,
    ]);
  });
});

