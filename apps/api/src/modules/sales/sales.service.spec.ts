import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderStatus, PaymentStatus } from '../../common/enums/sale.enum.js';
import { UserRole } from '../../common/enums/user.enum.js';
import {
  Inventory,
  MenuItem,
  Outlet,
  OutletMenuItem,
  Sale,
  User,
} from '../../database/entities/index.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { ListSalesQueryDto } from './dto/list-sales-query.dto.js';
import { SalesService } from './sales.service.js';

const outlet = {
  id: 'outlet-id',
  companyId: 'company-id',
  name: 'Downtown Branch',
  code: 'OUT-001',
} as Outlet;

const menuItem = {
  id: 'menu-item-id',
  name: 'Classic Burger',
  basePrice: 9,
} as MenuItem;

const createdAt = new Date('2026-11-07T03:00:00.000Z');

const baseSale = {
  id: 'sale-id',
  outletId: outlet.id,
  receiptNo: 4,
  total: 17,
  tableNo: 'T12',
  orderStatus: OrderStatus.SERVED,
  paymentStatus: PaymentStatus.PAID,
  idempotencyKey: 'key-1',
  createdAt,
  outlet,
  items: [
    {
      id: 'item-1',
      saleId: 'sale-id',
      menuItemId: menuItem.id,
      quantity: 2,
      unitPrice: 8.5,
      lineTotal: 17,
      menuItem,
    },
  ],
} as Sale;

const hqAdminUser = {
  id: 'user-id',
  role: UserRole.HQ_ADMIN,
  companyId: 'company-id',
  outletId: null,
  isActive: true,
} as User;

const superAdminUser = {
  id: 'super-id',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
  outletId: null,
  isActive: true,
} as User;

const outletStaffUser = {
  id: 'staff-id',
  role: UserRole.OUTLET_STAFF,
  companyId: 'company-id',
  outletId: outlet.id,
  isActive: true,
} as User;

function queryBuilder() {
  const builder = {
    innerJoin: vi.fn(),
    innerJoinAndSelect: vi.fn(),
    leftJoinAndSelect: vi.fn(),
    andWhere: vi.fn(),
    where: vi.fn(),
    select: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    clone: vi.fn(),
    setLock: vi.fn(),
    getCount: vi.fn(),
    getMany: vi.fn(),
  };

  for (const method of [
    builder.innerJoin,
    builder.innerJoinAndSelect,
    builder.leftJoinAndSelect,
    builder.andWhere,
    builder.where,
    builder.select,
    builder.orderBy,
    builder.addOrderBy,
    builder.skip,
    builder.take,
    builder.setLock,
  ]) {
    method.mockReturnValue(builder);
  }
  builder.clone.mockReturnValue(builder);
  return builder;
}

describe('SalesService', () => {
  let service: SalesService;
  let saleRepository: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let outletRepository: Pick<Repository<Outlet>, 'findOne'>;
  let userRepository: Pick<Repository<User>, 'findOne'>;
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let builders: ReturnType<typeof queryBuilder>[];
  let pageRows: Array<{ id: string }>;
  let pageTotal: number;
  let manager: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let inventoryQuery: ReturnType<typeof queryBuilder>;
  let inventory: Inventory;

  beforeEach(() => {
    builders = [];
    pageRows = [{ id: baseSale.id }];
    pageTotal = 1;
    saleRepository = {
      createQueryBuilder: vi.fn(() => {
        const builder = queryBuilder();
        builder.getCount.mockImplementation(async () => pageTotal);
        builder.getMany.mockImplementation(async () =>
          builder.select.mock.calls.length > 0 ? pageRows : [baseSale],
        );
        builders.push(builder);
        return builder;
      }),
      findOne: vi.fn().mockResolvedValue(null),
    };
    outletRepository = {
      findOne: vi.fn().mockResolvedValue(outlet),
    };
    userRepository = {
      findOne: vi.fn().mockResolvedValue(hqAdminUser),
    };

    inventory = {
      id: 'inventory-id',
      outletId: outlet.id,
      menuItemId: menuItem.id,
      quantity: 5,
    } as Inventory;
    inventoryQuery = queryBuilder();
    inventoryQuery.getMany.mockResolvedValue([inventory]);
    manager = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([
        {
          outletId: outlet.id,
          menuItemId: menuItem.id,
          outletPrice: 8.5,
          isActive: true,
          menuItem,
        } as OutletMenuItem,
      ]),
      query: vi.fn(async (sql: string) =>
        sql.includes('UPDATE') ? [[{ last_number: '4' }], 1] : [],
      ),
      createQueryBuilder: vi.fn().mockReturnValue(inventoryQuery),
      create: vi.fn((_entity: unknown, plain: unknown) => plain),
      save: vi.fn(async (entityOrTarget: unknown, maybeEntities?: unknown) => {
        if (maybeEntities) {
          return maybeEntities;
        }

        const sale = entityOrTarget as Sale;
        return {
          ...sale,
          id: 'sale-id',
          createdAt,
          items: sale.items.map((item, index) => ({
            ...item,
            id: `item-${index + 1}`,
          })),
        };
      }),
    };
    dataSource = {
      transaction: vi.fn(
        async (callback: (entityManager: typeof manager) => unknown) =>
          callback(manager),
      ),
    };

    service = new SalesService(
      saleRepository as unknown as Repository<Sale>,
      outletRepository as Repository<Outlet>,
      userRepository as Repository<User>,
      dataSource as never,
    );
  });

  it('scopes sales history to the company for an HQ admin', async () => {
    await expect(
      service.findAll('user-id', { page: 1, limit: 20 } as ListSalesQueryDto),
    ).resolves.toMatchObject({
      total: 1,
      page: 1,
      limit: 20,
      items: [
        {
          id: 'sale-id',
          outletName: 'Downtown Branch',
          receiptNo: 4,
          total: 17,
          items: [
            { menuItemName: 'Classic Burger', quantity: 2, lineTotal: 17 },
          ],
        },
      ],
    });

    expect(builders[0]?.andWhere).toHaveBeenCalledWith(
      'outlet.companyId = :companyId',
      { companyId: 'company-id' },
    );
    expect(builders[1]?.where).toHaveBeenCalledWith('sale.id IN (:...ids)', {
      ids: ['sale-id'],
    });
  });

  it('lets a super admin read every company unless a company filter is set', async () => {
    userRepository.findOne = vi.fn().mockResolvedValue(superAdminUser);
    pageTotal = 0;
    pageRows = [];

    await expect(
      service.findAll('super-id', { page: 1, limit: 20 } as ListSalesQueryDto),
    ).resolves.toEqual({ items: [], total: 0, page: 1, limit: 20 });
    expect(builders[0]?.andWhere).not.toHaveBeenCalled();

    await service.findAll('super-id', {
      page: 1,
      limit: 20,
      companyId: 'other-company',
      outletId: 'other-outlet',
    } as ListSalesQueryDto);

    expect(builders[1]?.andWhere).toHaveBeenCalledWith(
      'outlet.companyId = :companyId',
      { companyId: 'other-company' },
    );
    expect(builders[1]?.andWhere).toHaveBeenCalledWith(
      'sale.outletId = :outletId',
      {
        outletId: 'other-outlet',
      },
    );
  });

  it('limits outlet staff to their own outlet', async () => {
    userRepository.findOne = vi.fn().mockResolvedValue(outletStaffUser);

    await service.findAll('staff-id', {
      page: 1,
      limit: 20,
    } as ListSalesQueryDto);

    expect(builders[0]?.andWhere).toHaveBeenCalledWith(
      'sale.outletId = :outletId',
      {
        outletId: outlet.id,
      },
    );
    await expect(
      service.findAll('staff-id', {
        page: 1,
        limit: 20,
        outletId: 'other-outlet',
      } as ListSalesQueryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.findAll('staff-id', {
        page: 1,
        limit: 20,
        companyId: 'company-id',
      } as ListSalesQueryDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies search, status, table, and date filters', async () => {
    await service.findAll('user-id', {
      page: 2,
      limit: 10,
      search: '12',
      outletId: outlet.id,
      orderStatus: OrderStatus.OPEN,
      paymentStatus: PaymentStatus.UNPAID,
      tableNo: 'T12',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-07T00:00:00.000Z',
    } as ListSalesQueryDto);

    expect(outletRepository.findOne).toHaveBeenCalledWith({
      where: { id: outlet.id, companyId: 'company-id' },
    });
    expect(builders[0]?.andWhere).toHaveBeenCalledWith(
      'sale.receiptNo = :receiptNo',
      {
        receiptNo: '12',
      },
    );
    expect(builders[0]?.andWhere).toHaveBeenCalledWith(
      'sale.orderStatus = :orderStatus',
      { orderStatus: OrderStatus.OPEN },
    );
    expect(builders[0]?.andWhere).toHaveBeenCalledWith(
      'sale.paymentStatus = :paymentStatus',
      { paymentStatus: PaymentStatus.UNPAID },
    );
    expect(builders[0]?.andWhere).toHaveBeenCalledWith(
      'sale.tableNo = :tableNo',
      {
        tableNo: 'T12',
      },
    );
    expect(builders[0]?.andWhere).toHaveBeenCalledWith(
      'sale.createdAt >= :from',
      {
        from: new Date('2026-11-01T00:00:00.000Z'),
      },
    );
    expect(builders[0]?.andWhere).toHaveBeenCalledWith(
      'sale.createdAt <= :to',
      {
        to: new Date('2026-11-07T00:00:00.000Z'),
      },
    );
    expect(builders[0]?.skip).toHaveBeenCalledWith(10);
    expect(builders[0]?.take).toHaveBeenCalledWith(10);

    await service.findAll('user-id', {
      page: 1,
      limit: 20,
      search: 'patio',
    } as ListSalesQueryDto);
    expect(builders[2]?.andWhere).toHaveBeenCalledWith(
      'sale.tableNo ILIKE :search',
      {
        search: '%patio%',
      },
    );
  });

  it('hides a sale outside the caller scope', async () => {
    saleRepository.findOne.mockResolvedValue(baseSale);
    await expect(service.findOne('user-id', 'sale-id')).resolves.toMatchObject({
      id: 'sale-id',
      companyId: 'company-id',
    });

    saleRepository.findOne.mockResolvedValue({
      ...baseSale,
      outlet: { ...outlet, companyId: 'other-company' },
    });
    await expect(service.findOne('user-id', 'sale-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    userRepository.findOne = vi.fn().mockResolvedValue(superAdminUser);
    await expect(service.findOne('super-id', 'sale-id')).resolves.toMatchObject(
      {
        id: 'sale-id',
      },
    );

    userRepository.findOne = vi.fn().mockResolvedValue(outletStaffUser);
    saleRepository.findOne.mockResolvedValue({
      ...baseSale,
      outletId: 'other-outlet',
    });
    await expect(service.findOne('staff-id', 'sale-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an HQ admin sale for an outlet outside the company', async () => {
    outletRepository.findOne = vi.fn().mockResolvedValue({
      ...outlet,
      companyId: 'other-company',
    });

    await expect(
      service.create('user-id', {
        outletId: outlet.id,
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
      } as CreateSaleDto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('creates a sale for the outlet assigned to an outlet user', async () => {
    userRepository.findOne = vi.fn().mockResolvedValue(outletStaffUser);

    const result = await service.create('staff-id', {
      tableNo: 'T12',
      items: [{ menuItemId: menuItem.id, quantity: 2 }],
    } as CreateSaleDto);

    expect(outletRepository.findOne).toHaveBeenCalledWith({
      where: { id: outlet.id },
    });
    expect(result.created).toBe(true);
    expect(result.sale).toMatchObject({
      receiptNo: 4,
      total: 17,
      tableNo: 'T12',
      orderStatus: OrderStatus.SERVED,
      paymentStatus: PaymentStatus.PAID,
      items: [{ unitPrice: 8.5, lineTotal: 17, quantity: 2 }],
    });
    expect(inventory.quantity).toBe(3);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "outlet_receipt_counters"'),
      [outlet.id],
    );
    expect(inventoryQuery.orderBy).toHaveBeenCalledWith(
      'inventory.menuItemId',
      'ASC',
    );
    expect(inventoryQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  it('rejects a sale for another outlet from an outlet user', async () => {
    userRepository.findOne = vi.fn().mockResolvedValue(outletStaffUser);

    await expect(
      service.create('staff-id', {
        outletId: 'other-outlet',
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
      } as CreateSaleDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a sale when stock is insufficient or the item is not assigned', async () => {
    inventory.quantity = 1;
    await expect(
      service.create('user-id', {
        outletId: outlet.id,
        items: [{ menuItemId: menuItem.id, quantity: 2 }],
      } as CreateSaleDto),
    ).rejects.toThrow('Insufficient stock for Classic Burger');
    expect(manager.save).not.toHaveBeenCalled();

    manager.find.mockResolvedValue([]);
    await expect(
      service.create('user-id', {
        outletId: outlet.id,
        items: [{ menuItemId: menuItem.id, quantity: 1 }],
      } as CreateSaleDto),
    ).rejects.toThrow('Menu item is not assigned to this outlet');
  });

  it('returns the original sale when the idempotency key was already used', async () => {
    saleRepository.findOne.mockResolvedValue(baseSale);

    await expect(
      service.create(
        'user-id',
        {
          outletId: outlet.id,
          items: [{ menuItemId: menuItem.id, quantity: 1 }],
        } as CreateSaleDto,
        'key-1',
      ),
    ).resolves.toEqual({
      created: false,
      sale: expect.objectContaining({ id: 'sale-id' }),
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('returns the winning sale when a concurrent idempotency key conflicts', async () => {
    saleRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseSale);
    dataSource.transaction.mockRejectedValue(
      new QueryFailedError('INSERT', [], {
        code: '23505',
        constraint: 'uq_sales_outlet_idempotency',
      } as unknown as Error),
    );

    await expect(
      service.create(
        'user-id',
        {
          outletId: outlet.id,
          items: [{ menuItemId: menuItem.id, quantity: 1 }],
        } as CreateSaleDto,
        'key-1',
      ),
    ).resolves.toMatchObject({ created: false, sale: { id: 'sale-id' } });
  });

  it('rejects duplicate menu items before opening a transaction', async () => {
    await expect(
      service.create('user-id', {
        outletId: outlet.id,
        items: [
          { menuItemId: menuItem.id, quantity: 1 },
          { menuItemId: menuItem.id, quantity: 2 },
        ],
      } as CreateSaleDto),
    ).rejects.toThrow('Duplicate menu items are not allowed');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
