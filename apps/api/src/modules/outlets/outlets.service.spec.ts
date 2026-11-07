import { ForbiddenException } from '@nestjs/common';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../../common/enums/user.enum.js';
import { Outlet, User } from '../../database/entities/index.js';
import { ListOutletsQueryDto } from './dto/list-outlets-query.dto.js';
import { OutletsService } from './outlets.service.js';

describe('OutletsService', () => {
  let service: OutletsService;
  let outletRepository: Pick<Repository<Outlet>, 'createQueryBuilder'>;
  let userRepository: Pick<Repository<User>, 'findOne'>;
  let queryBuilder: {
    where: ReturnType<typeof vi.fn>;
    andWhere: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    addOrderBy: ReturnType<typeof vi.fn>;
    skip: ReturnType<typeof vi.fn>;
    take: ReturnType<typeof vi.fn>;
    getManyAndCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queryBuilder = {
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      addOrderBy: vi.fn(),
      skip: vi.fn(),
      take: vi.fn(),
      getManyAndCount: vi.fn(),
    };
    for (const method of [
      queryBuilder.where,
      queryBuilder.andWhere,
      queryBuilder.orderBy,
      queryBuilder.addOrderBy,
      queryBuilder.skip,
      queryBuilder.take,
    ]) {
      method.mockReturnValue(queryBuilder);
    }

    outletRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };
    userRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'user-id',
        role: UserRole.HQ_ADMIN,
        companyId: 'company-id',
        isActive: true,
      }),
    };
    service = new OutletsService(
      outletRepository as Repository<Outlet>,
      userRepository as Repository<User>,
    );
  });

  it('scopes outlet results to the active HQ admin company', async () => {
    const items = [{ id: 'outlet-id', name: 'Downtown' }] as Outlet[];
    queryBuilder.getManyAndCount.mockResolvedValue([items, 1]);

    await expect(
      service.findCompanyOutlets('user-id', {
        page: 1,
        limit: 20,
      } as ListOutletsQueryDto),
    ).resolves.toEqual({ items, total: 1, page: 1, limit: 20 });

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      select: {
        id: true,
        role: true,
        companyId: true,
        isActive: true,
      },
    });
    expect(outletRepository.createQueryBuilder).toHaveBeenCalledWith('outlet');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'outlet.companyId = :companyId',
      { companyId: 'company-id' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('outlet.name', 'ASC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('outlet.id', 'ASC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(20);
  });

  it('applies exact code/location filters and a grouped text search', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    const query = {
      page: 2,
      limit: 5,
      search: 'downtown',
      code: 'OUT-001',
      location: 'Central',
    } as ListOutletsQueryDto;

    await service.findCompanyOutlets('user-id', query);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('outlet.code = :code', {
      code: 'OUT-001',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'outlet.location = :location',
      { location: 'Central' },
    );
    const searchCondition = queryBuilder.andWhere.mock.calls.find(
      ([condition]) => condition instanceof Brackets,
    );
    expect(searchCondition).toBeDefined();
    expect(searchCondition?.[1]).toEqual({ search: '%downtown%' });

    const searchBuilder = {
      where: vi.fn().mockReturnThis(),
      orWhere: vi.fn().mockReturnThis(),
    };
    const brackets = searchCondition?.[0] as Brackets;
    brackets.whereFactory(
      searchBuilder as unknown as SelectQueryBuilder<Outlet>,
    );
    expect(searchBuilder.where).toHaveBeenCalledWith(
      'outlet.name ILIKE :search',
    );
    expect(searchBuilder.orWhere).toHaveBeenNthCalledWith(
      1,
      'outlet.code ILIKE :search',
    );
    expect(searchBuilder.orWhere).toHaveBeenNthCalledWith(
      2,
      'outlet.location ILIKE :search',
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
  });

  it('lists every outlet for a super admin, including one without a company', async () => {
    vi.mocked(userRepository.findOne).mockResolvedValue({
      id: 'super-id',
      role: UserRole.SUPER_ADMIN,
      companyId: null,
      isActive: true,
    } as User);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findCompanyOutlets('super-id', {
      page: 1,
      limit: 20,
    } as ListOutletsQueryDto);

    expect(queryBuilder.where).not.toHaveBeenCalled();
    expect(outletRepository.createQueryBuilder).toHaveBeenCalledWith('outlet');
  });

  it.each([
    {
      reason: 'missing user',
      user: null,
    },
    {
      reason: 'inactive user',
      user: {
        role: UserRole.HQ_ADMIN,
        companyId: 'company-id',
        isActive: false,
      },
    },
    {
      reason: 'non-HQ role',
      user: {
        role: UserRole.OUTLET_MANAGER,
        companyId: 'company-id',
        isActive: true,
      },
    },
    {
      reason: 'unassigned company',
      user: {
        role: UserRole.HQ_ADMIN,
        companyId: null,
        isActive: true,
      },
    },
  ])('fails closed for $reason', async ({ user }) => {
    vi.mocked(userRepository.findOne).mockResolvedValue(user as User | null);

    await expect(
      service.findCompanyOutlets('user-id', {
        page: 1,
        limit: 20,
      } as ListOutletsQueryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(outletRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
