import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../../common/enums/user.enum.js';
import {
  MenuItem,
  Outlet,
  OutletMenuItem,
  User,
} from '../../database/entities/index.js';
import { CreateOutletMenuItemDto } from './dto/create-outlet-menu-item.dto.js';
import { ListOutletMenuItemsQueryDto } from './dto/list-outlet-menu-items-query.dto.js';
import { UpdateOutletMenuItemPriceDto } from './dto/update-outlet-menu-item-price.dto.js';
import { OutletMenuItemsService } from './outlet-menu-items.service.js';

describe('OutletMenuItemsService', () => {
  let service: OutletMenuItemsService;
  let outletMenuItemRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let outletRepository: Pick<Repository<Outlet>, 'findOne'>;
  let menuItemRepository: Pick<Repository<MenuItem>, 'findOneBy'>;
  let userRepository: Pick<Repository<User>, 'findOne'>;
  let queryBuilder: {
    innerJoinAndSelect: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    andWhere: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    addOrderBy: ReturnType<typeof vi.fn>;
    skip: ReturnType<typeof vi.fn>;
    take: ReturnType<typeof vi.fn>;
    getManyAndCount: ReturnType<typeof vi.fn>;
  };

  const outlet = {
    id: 'outlet-id',
    companyId: 'company-id',
    name: 'Downtown Branch',
  } as Outlet;
  const menuItem = {
    id: 'menu-item-id',
    name: 'Chicken Burger',
  } as MenuItem;

  beforeEach(() => {
    queryBuilder = {
      innerJoinAndSelect: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      addOrderBy: vi.fn(),
      skip: vi.fn(),
      take: vi.fn(),
      getManyAndCount: vi.fn(),
    };
    for (const method of [
      queryBuilder.innerJoinAndSelect,
      queryBuilder.where,
      queryBuilder.andWhere,
      queryBuilder.orderBy,
      queryBuilder.addOrderBy,
      queryBuilder.skip,
      queryBuilder.take,
    ]) {
      method.mockReturnValue(queryBuilder);
    }

    outletMenuItemRepository = {
      create: vi.fn((data) => data),
      save: vi.fn(async (assignment) => assignment),
      findOne: vi.fn(),
      remove: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };
    outletRepository = { findOne: vi.fn().mockResolvedValue(outlet) };
    menuItemRepository = { findOneBy: vi.fn().mockResolvedValue(menuItem) };
    userRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'user-id',
        role: UserRole.HQ_ADMIN,
        companyId: 'company-id',
        isActive: true,
      }),
    };

    service = new OutletMenuItemsService(
      outletMenuItemRepository as unknown as Repository<OutletMenuItem>,
      outletRepository as Repository<Outlet>,
      menuItemRepository as Repository<MenuItem>,
      userRepository as Repository<User>,
    );
  });

  it('assigns a menu item to a company outlet', async () => {
    const saved = {
      id: 'assignment-id',
      outletId: outlet.id,
      menuItemId: menuItem.id,
      outletPrice: 250,
      isActive: false,
      createdAt: new Date('2026-11-06T00:00:00.000Z'),
      updatedAt: new Date('2026-11-06T00:00:00.000Z'),
    } as OutletMenuItem;
    vi.mocked(outletMenuItemRepository.save).mockResolvedValue(saved);

    await expect(
      service.create('user-id', {
        outletId: outlet.id,
        menuItemId: menuItem.id,
        outletPrice: 250,
      } as CreateOutletMenuItemDto),
    ).resolves.toMatchObject({
      id: 'assignment-id',
      outletName: 'Downtown Branch',
      menuItemName: 'Chicken Burger',
      outletPrice: 250,
      isActive: false,
    });
    expect(outletRepository.findOne).toHaveBeenCalledWith({
      where: { id: outlet.id, companyId: 'company-id' },
    });
  });

  it('rejects assignment when the outlet or menu item is missing', async () => {
    vi.mocked(outletRepository.findOne).mockResolvedValue(null);

    await expect(
      service.create('user-id', {
        outletId: outlet.id,
        menuItemId: menuItem.id,
      } as CreateOutletMenuItemDto),
    ).rejects.toBeInstanceOf(NotFoundException);

    vi.mocked(outletRepository.findOne).mockResolvedValue(outlet);
    vi.mocked(menuItemRepository.findOneBy).mockResolvedValue(null);

    await expect(
      service.create('user-id', {
        outletId: outlet.id,
        menuItemId: menuItem.id,
      } as CreateOutletMenuItemDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a duplicate assignment to a conflict', async () => {
    vi.mocked(outletMenuItemRepository.save).mockRejectedValue(
      new QueryFailedError(
        'insert',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_outlet_menu_items_outlet_item',
        }),
      ),
    );

    await expect(
      service.create('user-id', {
        outletId: outlet.id,
        menuItemId: menuItem.id,
      } as CreateOutletMenuItemDto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists company assignments with search, filters, and pagination', async () => {
    const assignment = {
      id: 'assignment-id',
      outletId: outlet.id,
      menuItemId: menuItem.id,
      outletPrice: 250,
      isActive: true,
      createdAt: new Date('2026-11-06T00:00:00.000Z'),
      updatedAt: new Date('2026-11-06T00:00:00.000Z'),
      menuItem,
      outlet,
    } as OutletMenuItem;
    queryBuilder.getManyAndCount.mockResolvedValue([[assignment], 1]);

    await expect(
      service.findAll('user-id', {
        page: 2,
        limit: 5,
        search: 'burger',
        outletId: outlet.id,
        isActive: true,
      } as ListOutletMenuItemsQueryDto),
    ).resolves.toMatchObject({
      total: 1,
      page: 2,
      limit: 5,
      items: [{ menuItemName: 'Chicken Burger', outletName: 'Downtown Branch' }],
    });

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'outlet.companyId = :companyId',
      { companyId: 'company-id' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.outletId = :outletId',
      { outletId: outlet.id },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.isActive = :isActive',
      { isActive: true },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'menuItem.name ILIKE :search',
      { search: '%burger%' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('menuItem.name', 'ASC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('assignment.id', 'ASC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
  });

  it('limits an outlet user to their own outlet', async () => {
    vi.mocked(userRepository.findOne).mockResolvedValue({
      id: 'user-id',
      role: UserRole.OUTLET_STAFF,
      companyId: 'company-id',
      outletId: 'staff-outlet',
      isActive: true,
    } as User);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll('user-id', {
      page: 1,
      limit: 20,
      outletId: 'other-outlet',
    } as ListOutletMenuItemsQueryDto);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'assignment.outletId = :outletId',
      { outletId: 'staff-outlet' },
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'assignment.outletId = :outletId',
      { outletId: 'other-outlet' },
    );
  });

  it('denies an outlet user who is not assigned to an outlet', async () => {
    vi.mocked(userRepository.findOne).mockResolvedValue({
      id: 'user-id',
      role: UserRole.OUTLET_MANAGER,
      companyId: 'company-id',
      outletId: null,
      isActive: true,
    } as User);

    await expect(
      service.findAll('user-id', {
        page: 1,
        limit: 20,
      } as ListOutletMenuItemsQueryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(outletMenuItemRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('updates the price of an existing assignment', async () => {
    const assignment = {
      id: 'assignment-id',
      outletId: outlet.id,
      menuItemId: menuItem.id,
      outletPrice: 200,
      isActive: true,
      menuItem,
      createdAt: new Date('2026-11-06T00:00:00.000Z'),
      updatedAt: new Date('2026-11-06T00:00:00.000Z'),
    } as OutletMenuItem;
    vi.mocked(outletMenuItemRepository.findOne).mockResolvedValue(assignment);

    await expect(
      service.updatePrice('user-id', menuItem.id, {
        outletId: outlet.id,
        outletPrice: 275,
      } as UpdateOutletMenuItemPriceDto),
    ).resolves.toMatchObject({ outletPrice: 275 });
    expect(outletMenuItemRepository.findOne).toHaveBeenCalledWith({
      where: { outletId: outlet.id, menuItemId: menuItem.id },
      relations: { menuItem: true },
    });
  });

  it('removes an assignment without deleting the menu item', async () => {
    const assignment = { id: 'assignment-id', menuItem } as OutletMenuItem;
    vi.mocked(outletMenuItemRepository.findOne).mockResolvedValue(assignment);

    await expect(
      service.remove('user-id', menuItem.id, outlet.id),
    ).resolves.toEqual({
      message: 'Outlet menu assignment removed successfully',
    });
    expect(outletMenuItemRepository.remove).toHaveBeenCalledWith(assignment);
    expect(menuItemRepository.findOneBy).not.toHaveBeenCalled();
  });

  it.each([
    { reason: 'missing user', user: null },
    {
      reason: 'inactive user',
      user: {
        role: UserRole.HQ_ADMIN,
        companyId: 'company-id',
        isActive: false,
      },
    },
    {
      reason: 'unassigned company',
      user: { role: UserRole.HQ_ADMIN, companyId: null, isActive: true },
    },
  ])('denies list access for $reason', async ({ user }) => {
    vi.mocked(userRepository.findOne).mockResolvedValue(user as User | null);

    await expect(
      service.findAll('user-id', {
        page: 1,
        limit: 20,
      } as ListOutletMenuItemsQueryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(outletMenuItemRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
