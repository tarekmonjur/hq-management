import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { ListOutletsQueryDto } from './dto/list-outlets-query.dto.js';
import { OutletsController } from './outlets.controller.js';
import { OutletsService } from './outlets.service.js';

describe('OutletsController', () => {
  it('passes the authenticated subject and validated query to the service', () => {
    const service = {
      findCompanyOutlets: vi.fn().mockReturnValue({ items: [], total: 0 }),
    };
    const controller = new OutletsController(
      service as unknown as OutletsService,
    );
    const user = { sub: 'user-id' } as JwtPayload;
    const query = { page: 2, limit: 10 } as ListOutletsQueryDto;

    expect(controller.findAll(user, query)).toEqual({
      items: [],
      total: 0,
    });
    expect(service.findCompanyOutlets).toHaveBeenCalledWith('user-id', query);
  });

  it('requires the HQ_ADMIN or SUPER_ADMIN role for the endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, OutletsController)).toEqual([
      UserRole.HQ_ADMIN,
      UserRole.SUPER_ADMIN,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, OutletsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });
});
