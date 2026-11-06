import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../../common/enums/user.enum.js';
import { MenuItemUnit } from '../../common/enums/menu-item.enum.js';
import {
  Inventory,
  MenuItem,
  Outlet,
  User,
} from '../../database/entities/index.js';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';
import { ListInventoriesQueryDto } from './dto/list-inventories-query.dto.js';
import { InventoriesService } from './inventories.service.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const outlet = {
  id: 'outlet-id',
  companyId: 'company-id',
  name: 'Downtown Branch',
  code: 'OUT-001',
} as Outlet;

const menuItem = {
  id: 'menu-item-id',
  name: 'Chicken Burger',
  unit: MenuItemUnit.PIECE,
} as MenuItem;

const baseInventory = {
  id: 'inventory-id',
  outletId: outlet.id,
  menuItemId: menuItem.id,
  quantity: 50,
  outlet,
  menuItem,
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-11-06T17:00:00.000Z'),
} as Inventory;

const hqAdminUser = {
  id: 'user-id',
  role: UserRole.HQ_ADMIN,
  companyId: 'company-id',
  outletId: null,
  isActive: true,
} as User;

// ---------------------------------------------------------------------------

describe('InventoriesService', () => {
  let service: InventoriesService;
  let inventoryRepository: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
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

    inventoryRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      findOne: vi.fn(),
      save: vi.fn(async (inv: Inventory) => inv),
    };
    userRepository = {
      findOne: vi.fn().mockResolvedValue(hqAdminUser),
    };

    service = new InventoriesService(
      inventoryRepository as unknown as Repository<Inventory>,
      {} as Repository<Outlet>, // outletRepository not used in current service methods
      userRepository as Repository<User>,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll — HQ_ADMIN / SUPER_ADMIN
  // ─────────────────────────────────────────────────────────────────────────

  it('scopes inventory list to the company for an HQ_ADMIN', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[baseInventory], 1]);

    await expect(
      service.findAll('user-id', { page: 1, limit: 20 } as ListInventoriesQueryDto),
    ).resolves.toMatchObject({
      total: 1,
      page: 1,
      limit: 20,
      items: [
        {
          id: 'inventory-id',
          outletId: outlet.id,
          outletName: 'Downtown Branch',
          outletCode: 'OUT-001',
          menuItemId: menuItem.id,
          menuItemName: 'Chicken Burger',
          menuItemUnit: MenuItemUnit.PIECE,
          quantity: 50,
        },
      ],
    });

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      select: {
        id: true,
        role: true,
        companyId: true,
        outletId: true,
        isActive: true,
      },
    });
    expect(inventoryRepository.createQueryBuilder).toHaveBeenCalledWith(
      'inventory',
    );
    expect(queryBuilder.innerJoinAndSelect).toHaveBeenCalledWith(
      'inventory.menuItem',
      'menuItem',
    );
    expect(queryBuilder.innerJoinAndSelect).toHaveBeenCalledWith(
      'inventory.outlet',
      'outlet',
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'outlet.companyId = :companyId',
      { companyId: 'company-id' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('menuItem.name', 'ASC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('inventory.id', 'ASC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(20);
  });

  it('scopes inventory list to SUPER_ADMIN company as well', async () => {
    vi.mocked(userRepository.findOne).mockResolvedValue({
      ...hqAdminUser,
      role: UserRole.SUPER_ADMIN,
    } as User);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll('user-id', { page: 1, limit: 20 } as ListInventoriesQueryDto);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'outlet.companyId = :companyId',
      { companyId: 'company-id' },
    );
  });

  it('applies optional outletId filter when provided by an admin', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll('user-id', {
      page: 1,
      limit: 20,
      outletId: outlet.id,
    } as ListInventoriesQueryDto);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'inventory.outletId = :outletId',
      { outletId: outlet.id },
    );
  });

  it('applies search filter as a case-insensitive ILIKE on menu item name', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll('user-id', {
      page: 1,
      limit: 20,
      search: 'burger',
    } as ListInventoriesQueryDto);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'menuItem.name ILIKE :search',
      { search: '%burger%' },
    );
  });

  it('calculates the correct skip offset for paginated results', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll('user-id', {
      page: 3,
      limit: 10,
    } as ListInventoriesQueryDto);

    expect(queryBuilder.skip).toHaveBeenCalledWith(20);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll — OUTLET_MANAGER / OUTLET_STAFF
  // ─────────────────────────────────────────────────────────────────────────

  it('scopes inventory to the user outlet for an OUTLET_STAFF', async () => {
    vi.mocked(userRepository.findOne).mockResolvedValue({
      id: 'user-id',
      role: UserRole.OUTLET_STAFF,
      companyId: 'company-id',
      outletId: outlet.id,
      isActive: true,
    } as User);
    queryBuilder.getManyAndCount.mockResolvedValue([[baseInventory], 1]);

    await service.findAll('user-id', { page: 1, limit: 20 } as ListInventoriesQueryDto);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'inventory.outletId = :outletId',
      { outletId: outlet.id },
    );
    // Admin company scope must NOT be applied for outlet roles
    expect(queryBuilder.where).not.toHaveBeenCalledWith(
      'outlet.companyId = :companyId',
      expect.anything(),
    );
  });

  it('scopes inventory to the user outlet for an OUTLET_MANAGER', async () => {
    vi.mocked(userRepository.findOne).mockResolvedValue({
      id: 'user-id',
      role: UserRole.OUTLET_MANAGER,
      companyId: 'company-id',
      outletId: outlet.id,
      isActive: true,
    } as User);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findAll('user-id', { page: 1, limit: 20 } as ListInventoriesQueryDto);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'inventory.outletId = :outletId',
      { outletId: outlet.id },
    );
  });

  it('throws ForbiddenException when an outlet-role user has no outletId assigned', async () => {
    vi.mocked(userRepository.findOne).mockResolvedValue({
      id: 'user-id',
      role: UserRole.OUTLET_STAFF,
      companyId: 'company-id',
      outletId: null,
      isActive: true,
    } as User);

    await expect(
      service.findAll('user-id', { page: 1, limit: 20 } as ListInventoriesQueryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // createQueryBuilder is called before the outletId guard, but the query is never
    // executed — getManyAndCount must not have been called
    expect(queryBuilder.getManyAndCount).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll — authentication / access guard cases
  // ─────────────────────────────────────────────────────────────────────────

  it.each([
    { reason: 'missing user', user: null },
    {
      reason: 'inactive user',
      user: { role: UserRole.HQ_ADMIN, companyId: 'company-id', outletId: null, isActive: false },
    },
  ])('denies findAll access for $reason', async ({ user }) => {
    vi.mocked(userRepository.findOne).mockResolvedValue(user as User | null);

    await expect(
      service.findAll('user-id', { page: 1, limit: 20 } as ListInventoriesQueryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inventoryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // adjustStock — success path
  // ─────────────────────────────────────────────────────────────────────────

  it('sets an absolute quantity and returns the updated inventory DTO', async () => {
    const updatedInventory = { ...baseInventory, quantity: 75 } as Inventory;
    vi.mocked(inventoryRepository.findOne).mockResolvedValue(updatedInventory);
    vi.mocked(inventoryRepository.save).mockResolvedValue(updatedInventory);

    await expect(
      service.adjustStock('user-id', 'inventory-id', { quantity: 75 } as AdjustInventoryDto),
    ).resolves.toMatchObject({
      id: 'inventory-id',
      quantity: 75,
      outletName: 'Downtown Branch',
      outletCode: 'OUT-001',
      menuItemName: 'Chicken Burger',
    });

    expect(inventoryRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'inventory-id' },
      relations: { menuItem: true, outlet: true },
    });
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 75 }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // adjustStock — authorization / error paths
  // ─────────────────────────────────────────────────────────────────────────

  it.each([
    { reason: 'OUTLET_MANAGER', role: UserRole.OUTLET_MANAGER },
    { reason: 'OUTLET_STAFF', role: UserRole.OUTLET_STAFF },
  ])('throws ForbiddenException when an $reason calls adjustStock', async ({ role }) => {
    vi.mocked(userRepository.findOne).mockResolvedValue({
      ...hqAdminUser,
      role,
      outletId: outlet.id,
    } as User);

    await expect(
      service.adjustStock('user-id', 'inventory-id', { quantity: 10 } as AdjustInventoryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inventoryRepository.findOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the inventory record does not exist', async () => {
    vi.mocked(inventoryRepository.findOne).mockResolvedValue(null);

    await expect(
      service.adjustStock('user-id', 'inventory-id', { quantity: 10 } as AdjustInventoryDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when the inventory belongs to a different company', async () => {
    vi.mocked(inventoryRepository.findOne).mockResolvedValue({
      ...baseInventory,
      outlet: { ...outlet, companyId: 'other-company-id' },
    } as Inventory);

    await expect(
      service.adjustStock('user-id', 'inventory-id', { quantity: 10 } as AdjustInventoryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inventoryRepository.save).not.toHaveBeenCalled();
  });

  it('maps a DB non-negative constraint violation to BadRequestException', async () => {
    vi.mocked(inventoryRepository.findOne).mockResolvedValue(baseInventory);
    vi.mocked(inventoryRepository.save).mockRejectedValue(
      new QueryFailedError(
        'update',
        [],
        Object.assign(new Error('check constraint violation'), {
          code: '23514',
          constraint: 'chk_inventories_quantity_non_negative',
        }),
      ),
    );

    await expect(
      service.adjustStock('user-id', 'inventory-id', { quantity: -1 } as AdjustInventoryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('re-throws unexpected errors from save without swallowing them', async () => {
    vi.mocked(inventoryRepository.findOne).mockResolvedValue(baseInventory);
    const unknownError = new Error('connection reset');
    vi.mocked(inventoryRepository.save).mockRejectedValue(unknownError);

    await expect(
      service.adjustStock('user-id', 'inventory-id', { quantity: 5 } as AdjustInventoryDto),
    ).rejects.toThrow('connection reset');
  });

  it.each([
    { reason: 'missing user', user: null },
    {
      reason: 'inactive user',
      user: { role: UserRole.HQ_ADMIN, companyId: 'company-id', outletId: null, isActive: false },
    },
  ])('denies adjustStock access for $reason', async ({ user }) => {
    vi.mocked(userRepository.findOne).mockResolvedValue(user as User | null);

    await expect(
      service.adjustStock('user-id', 'inventory-id', { quantity: 5 } as AdjustInventoryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inventoryRepository.findOne).not.toHaveBeenCalled();
  });
});
