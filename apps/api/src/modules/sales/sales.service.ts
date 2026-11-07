import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { OrderStatus, PaymentStatus } from '../../common/enums/sale.enum.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { hasConstraint } from '../../common/utils/postgres-error.util.js';
import {
  Inventory,
  type MenuItem,
  Outlet,
  OutletMenuItem,
  Sale,
  SaleItem,
  User,
} from '../../database/entities/index.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { ListSalesQueryDto } from './dto/list-sales-query.dto.js';
import { SaleResponseDto } from './dto/sale-response.dto.js';

const SALE_RELATIONS = {
  outlet: true,
  items: { menuItem: true },
} as const;

interface PricedLine {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  menuItem: MenuItem;
}

export interface CreateSaleResult {
  created: boolean;
  sale: SaleResponseDto;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    userId: string,
    dto: CreateSaleDto,
    idempotencyKey?: string | string[],
  ): Promise<CreateSaleResult> {
    const user = await this.loadActiveUser(userId);
    this.assertUniqueItems(dto);
    const outlet = await this.resolveCreateOutlet(user, dto.outletId);
    const key = this.normalizeIdempotencyKey(idempotencyKey);

    if (key) {
      const existing = await this.findByIdempotencyKey(outlet.id, key);
      if (existing) {
        return { created: false, sale: this.toResponse(existing) };
      }
    }

    try {
      return await this.dataSource.transaction((manager) =>
        this.createInTransaction(manager, outlet, dto, key),
      );
    } catch (error) {
      if (key && hasConstraint(error, '23505', 'uq_sales_outlet_idempotency')) {
        const existing = await this.findByIdempotencyKey(outlet.id, key);
        if (existing) {
          return { created: false, sale: this.toResponse(existing) };
        }
      }

      if (
        hasConstraint(error, '23514', 'chk_inventories_quantity_non_negative')
      ) {
        throw new BadRequestException('Insufficient stock');
      }

      throw error;
    }
  }

  async findAll(
    userId: string,
    query: ListSalesQueryDto,
  ): Promise<{
    items: SaleResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const user = await this.loadActiveUser(userId);
    const pageQuery = this.saleRepository
      .createQueryBuilder('sale')
      .innerJoin('sale.outlet', 'outlet');

    await this.applyScope(pageQuery, user, query);
    this.applyFilters(pageQuery, query);

    const total = await pageQuery.clone().getCount();
    const page = await pageQuery
      .select(['sale.id', 'sale.createdAt'])
      .orderBy('sale.createdAt', 'DESC')
      .addOrderBy('sale.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();

    if (page.length === 0) {
      return { items: [], total, page: query.page, limit: query.limit };
    }

    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .innerJoinAndSelect('sale.outlet', 'outlet')
      .leftJoinAndSelect('sale.items', 'item')
      .leftJoinAndSelect('item.menuItem', 'menuItem')
      .where('sale.id IN (:...ids)', { ids: page.map((sale) => sale.id) })
      .orderBy('sale.createdAt', 'DESC')
      .addOrderBy('sale.id', 'DESC')
      .addOrderBy('item.id', 'ASC')
      .getMany();

    return {
      items: sales.map((sale) => this.toResponse(sale)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(userId: string, saleId: string): Promise<SaleResponseDto> {
    const user = await this.loadActiveUser(userId);
    this.assertOutletAssignment(user);

    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: SALE_RELATIONS,
    });

    if (!sale || !this.canReadSale(user, sale)) {
      throw new NotFoundException('Sale not found');
    }

    return this.toResponse(sale);
  }

  private async createInTransaction(
    manager: EntityManager,
    outlet: Outlet,
    dto: CreateSaleDto,
    idempotencyKey: string | null,
  ): Promise<CreateSaleResult> {
    if (idempotencyKey) {
      const existing = await manager.findOne(Sale, {
        where: { outletId: outlet.id, idempotencyKey },
        relations: SALE_RELATIONS,
      });
      if (existing) {
        return { created: false, sale: this.toResponse(existing) };
      }
    }

    const receiptNo = await this.allocateReceiptNo(manager, outlet.id);
    const menuItemIds = dto.items.map((item) => item.menuItemId).sort();
    const assignments = await manager.find(OutletMenuItem, {
      where: { outletId: outlet.id, menuItemId: In(menuItemIds) },
      relations: { menuItem: true },
    });
    const lines = this.priceLines(dto, assignments);
    await this.deductStock(manager, outlet.id, lines);

    const sale = manager.create(Sale, {
      outletId: outlet.id,
      receiptNo,
      total: fromMinorUnits(
        lines.reduce(
          (sum, line) => sum + toMinorUnits(line.unitPrice) * line.quantity,
          0,
        ),
      ),
      idempotencyKey,
      tableNo: dto.tableNo ?? null,
      orderStatus: dto.orderStatus ?? OrderStatus.SERVED,
      paymentStatus: dto.paymentStatus ?? PaymentStatus.PAID,
      items: lines.map((line) =>
        manager.create(SaleItem, {
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        }),
      ),
    });

    const saved = await manager.save(sale);
    saved.outlet = outlet;
    for (const item of saved.items) {
      const line = lines.find((entry) => entry.menuItemId === item.menuItemId);
      if (!line) {
        throw new InternalServerErrorException(
          'Saved sale item is missing its menu item',
        );
      }
      item.menuItem = line.menuItem;
    }

    return { created: true, sale: this.toResponse(saved) };
  }

  private async allocateReceiptNo(
    manager: EntityManager,
    outletId: string,
  ): Promise<number> {
    // The UPDATE row lock is held until commit, so concurrent sales on one outlet get unique receipt numbers.
    await manager.query(
      `INSERT INTO "outlet_receipt_counters" ("outlet_id", "last_number") VALUES ($1, 0) ON CONFLICT ("outlet_id") DO NOTHING`,
      [outletId],
    );
    const updated = await manager.query(
      `UPDATE "outlet_receipt_counters" SET "last_number" = "last_number" + 1 WHERE "outlet_id" = $1 RETURNING "last_number"`,
      [outletId],
    );
    const rows = rowsFromQuery<{ last_number: string | number }>(updated);
    const receiptNo = Number(rows[0]?.last_number);

    if (!Number.isInteger(receiptNo) || receiptNo <= 0) {
      throw new InternalServerErrorException(
        'Could not allocate a receipt number',
      );
    }

    return receiptNo;
  }

  private priceLines(
    dto: CreateSaleDto,
    assignments: OutletMenuItem[],
  ): PricedLine[] {
    const assignmentByMenuItemId = new Map(
      assignments.map((assignment) => [assignment.menuItemId, assignment]),
    );

    return dto.items.map((item) => {
      const assignment = assignmentByMenuItemId.get(item.menuItemId);
      if (!assignment) {
        throw new BadRequestException(
          'Menu item is not assigned to this outlet',
        );
      }
      if (!assignment.isActive) {
        throw new BadRequestException(
          'Menu item is not available at this outlet',
        );
      }

      const rawPrice = assignment.outletPrice ?? assignment.menuItem.basePrice;
      if (rawPrice === null || rawPrice === undefined) {
        throw new BadRequestException('Menu item has no price');
      }

      const unitPrice = fromMinorUnits(toMinorUnits(rawPrice));
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        lineTotal: fromMinorUnits(toMinorUnits(unitPrice) * item.quantity),
        menuItem: assignment.menuItem,
      };
    });
  }

  private async deductStock(
    manager: EntityManager,
    outletId: string,
    lines: PricedLine[],
  ): Promise<void> {
    const menuItemIds = lines.map((line) => line.menuItemId).sort();
    const inventories = await manager
      .createQueryBuilder(Inventory, 'inventory')
      .setLock('pessimistic_write')
      .where('inventory.outletId = :outletId', { outletId })
      .andWhere('inventory.menuItemId IN (:...menuItemIds)', { menuItemIds })
      .orderBy('inventory.menuItemId', 'ASC')
      .getMany();
    const inventoryByMenuItemId = new Map(
      inventories.map((inventory) => [inventory.menuItemId, inventory]),
    );

    for (const line of lines) {
      const inventory = inventoryByMenuItemId.get(line.menuItemId);
      if (!inventory) {
        throw new BadRequestException(
          'Menu item is not stocked at this outlet',
        );
      }
      if (inventory.quantity < line.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${line.menuItem.name}`,
        );
      }
      inventory.quantity -= line.quantity;
    }

    await manager.save(Inventory, inventories);
  }

  private async applyScope(
    queryBuilder: ReturnType<Repository<Sale>['createQueryBuilder']>,
    user: User,
    query: ListSalesQueryDto,
  ): Promise<void> {
    if (query.companyId && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'companyId filter is only available to super admins',
      );
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.companyId) {
        queryBuilder.andWhere('outlet.companyId = :companyId', {
          companyId: query.companyId,
        });
      }
      if (query.outletId) {
        queryBuilder.andWhere('sale.outletId = :outletId', {
          outletId: query.outletId,
        });
      }
      return;
    }

    if (user.role === UserRole.HQ_ADMIN) {
      queryBuilder.andWhere('outlet.companyId = :companyId', {
        companyId: user.companyId,
      });
      if (query.outletId) {
        const outlet = await this.outletRepository.findOne({
          where: { id: query.outletId, companyId: user.companyId ?? undefined },
        });
        if (!outlet) {
          throw new NotFoundException('Outlet not found');
        }
        queryBuilder.andWhere('sale.outletId = :outletId', {
          outletId: query.outletId,
        });
      }
      return;
    }

    this.assertOutletAssignment(user);
    if (query.outletId && query.outletId !== user.outletId) {
      throw new ForbiddenException('Sales history is limited to your outlet');
    }

    queryBuilder.andWhere('sale.outletId = :outletId', {
      outletId: user.outletId,
    });
  }

  private applyFilters(
    queryBuilder: ReturnType<Repository<Sale>['createQueryBuilder']>,
    query: ListSalesQueryDto,
  ): void {
    if (query.search) {
      if (/^\d+$/.test(query.search)) {
        queryBuilder.andWhere('sale.receiptNo = :receiptNo', {
          receiptNo: query.search,
        });
      } else {
        queryBuilder.andWhere('sale.tableNo ILIKE :search', {
          search: `%${query.search}%`,
        });
      }
    }

    if (query.orderStatus) {
      queryBuilder.andWhere('sale.orderStatus = :orderStatus', {
        orderStatus: query.orderStatus,
      });
    }

    if (query.paymentStatus) {
      queryBuilder.andWhere('sale.paymentStatus = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }

    if (query.tableNo) {
      queryBuilder.andWhere('sale.tableNo = :tableNo', {
        tableNo: query.tableNo,
      });
    }

    if (query.from) {
      queryBuilder.andWhere('sale.createdAt >= :from', {
        from: new Date(query.from),
      });
    }

    if (query.to) {
      queryBuilder.andWhere('sale.createdAt <= :to', {
        to: new Date(query.to),
      });
    }
  }

  private async resolveCreateOutlet(
    user: User,
    requestedOutletId?: string,
  ): Promise<Outlet> {
    const outletId = this.resolveCreateOutletId(user, requestedOutletId);
    const outlet = await this.outletRepository.findOne({
      where: { id: outletId },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    if (
      user.role === UserRole.HQ_ADMIN &&
      outlet.companyId !== user.companyId
    ) {
      throw new NotFoundException('Outlet not found');
    }

    return outlet;
  }

  private resolveCreateOutletId(
    user: User,
    requestedOutletId?: string,
  ): string {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.HQ_ADMIN) {
      if (!requestedOutletId) {
        throw new BadRequestException('outletId is required');
      }
      return requestedOutletId;
    }

    this.assertOutletAssignment(user);
    if (requestedOutletId && requestedOutletId !== user.outletId) {
      throw new ForbiddenException('Sale can only be created for your outlet');
    }

    return user.outletId!;
  }

  private assertOutletAssignment(user: User): void {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.HQ_ADMIN &&
      !user.outletId
    ) {
      throw new ForbiddenException('No outlet assigned to this user');
    }
  }

  private canReadSale(user: User, sale: Sale): boolean {
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }
    if (user.role === UserRole.HQ_ADMIN) {
      return sale.outlet.companyId === user.companyId;
    }
    return sale.outletId === user.outletId;
  }

  private assertUniqueItems(dto: CreateSaleDto): void {
    const ids = dto.items.map((item) => item.menuItemId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate menu items are not allowed');
    }
  }

  private normalizeIdempotencyKey(key?: string | string[]): string | null {
    const raw = Array.isArray(key) ? key[0] : key;
    if (raw === undefined || raw === null) {
      return null;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (trimmed.length > 64) {
      throw new BadRequestException(
        'Idempotency-Key must be at most 64 characters',
      );
    }

    return trimmed;
  }

  private async findByIdempotencyKey(
    outletId: string,
    idempotencyKey: string,
  ): Promise<Sale | null> {
    return this.saleRepository.findOne({
      where: { outletId, idempotencyKey },
      relations: SALE_RELATIONS,
    });
  }

  private async loadActiveUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        companyId: true,
        outletId: true,
        isActive: true,
      },
    });

    if (!user?.isActive) {
      throw new ForbiddenException('Sales access is not available');
    }

    if (user.role !== UserRole.SUPER_ADMIN && !user.companyId) {
      throw new ForbiddenException('Sales access is not available');
    }

    return user;
  }

  private toResponse(sale: Sale): SaleResponseDto {
    return {
      id: sale.id,
      outletId: sale.outletId,
      outletName: sale.outlet.name,
      outletCode: sale.outlet.code,
      companyId: sale.outlet.companyId,
      receiptNo: Number(sale.receiptNo),
      total: Number(sale.total),
      tableNo: sale.tableNo ?? null,
      orderStatus: sale.orderStatus,
      paymentStatus: sale.paymentStatus,
      idempotencyKey: sale.idempotencyKey ?? null,
      createdAt: sale.createdAt,
      items: [...(sale.items ?? [])]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((item) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          menuItemName: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
    };
  }
}

function rowsFromQuery<T>(result: unknown): T[] {
  if (!Array.isArray(result)) {
    return [];
  }

  // Postgres UPDATE/DELETE results are [rows, affectedCount]. INSERT returns rows.
  if (Array.isArray(result[0])) {
    return result[0] as T[];
  }

  return result as T[];
}

function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

function fromMinorUnits(amount: number): number {
  return amount / 100;
}
