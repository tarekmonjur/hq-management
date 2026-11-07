import { HttpStatus } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { ListSalesQueryDto } from './dto/list-sales-query.dto.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

describe('SalesController', () => {
  const service = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
  };
  const controller = new SalesController(service as unknown as SalesService);
  const user = { sub: 'user-id' } as JwtPayload;
  const roles = [
    UserRole.HQ_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.OUTLET_MANAGER,
    UserRole.OUTLET_STAFF,
  ];

  it('returns 201 when a sale is created', async () => {
    const dto = { items: [] } as CreateSaleDto;
    const sale = { id: 'sale-id' };
    const response = { status: vi.fn() } as unknown as Response;
    service.create.mockResolvedValue({ created: true, sale });

    await expect(
      controller.create(user, dto, 'idem-key', response),
    ).resolves.toEqual(sale);
    expect(service.create).toHaveBeenCalledWith('user-id', dto, 'idem-key');
    expect(response.status).toHaveBeenCalledWith(HttpStatus.CREATED);
  });

  it('returns 200 when the idempotency key matches an existing sale', async () => {
    const dto = { items: [] } as CreateSaleDto;
    const sale = { id: 'sale-id' };
    const response = { status: vi.fn() } as unknown as Response;
    service.create.mockResolvedValue({ created: false, sale });

    await expect(
      controller.create(user, dto, undefined, response),
    ).resolves.toEqual(sale);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('delegates findAll to the service with the user subject and query', () => {
    const query = { page: 1, limit: 20 } as ListSalesQueryDto;
    const result = { items: [], total: 0, page: 1, limit: 20 };
    service.findAll.mockReturnValue(result);

    expect(controller.findAll(user, query)).toEqual(result);
    expect(service.findAll).toHaveBeenCalledWith('user-id', query);
  });

  it('delegates findOne to the service with the user subject and sale id', () => {
    const result = { id: 'sale-id' };
    service.findOne.mockReturnValue(result);

    expect(controller.findOne(user, 'sale-id')).toEqual(result);
    expect(service.findOne).toHaveBeenCalledWith('user-id', 'sale-id');
  });

  it('applies JwtAuthGuard and RolesGuard at the class level', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SalesController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('allows every sales role on create, list, and detail', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.create)).toEqual(roles);
    expect(Reflect.getMetadata(ROLES_KEY, controller.findAll)).toEqual(roles);
    expect(Reflect.getMetadata(ROLES_KEY, controller.findOne)).toEqual(roles);
  });
});
