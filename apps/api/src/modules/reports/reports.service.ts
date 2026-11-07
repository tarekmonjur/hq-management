import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outlet } from '../../database/entities/outlet.entity.js';
import { Sale } from '../../database/entities/sale.entity.js';
import { SaleItem } from '../../database/entities/sale-item.entity.js';
import { OrderStatus, PaymentStatus } from '../../common/enums/sale.enum.js';
import { User } from '../../database/entities/user.entity.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto.js';
import {
  OutletRevenueItemDto,
  RevenueReportDataDto,
} from './dto/revenue-report-response.dto.js';
import { TopItemsReportQueryDto } from './dto/top-items-report-query.dto.js';
import {
  TopItemsReportDataDto,
  TopSellingItemDto,
} from './dto/top-items-report-response.dto.js';

interface OutletScopeResult {
  outlets: Outlet[];
  targetOutletId?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async loadActiveUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: { company: true, outlet: true },
    });

    if (!user) {
      throw new NotFoundException('Active user not found');
    }

    return user;
  }

  private parseDateRange(
    from?: string,
    to?: string,
  ): { fromDate?: Date; toDate?: Date } {
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (from) {
      fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException('Invalid from date format');
      }
    }

    if (to) {
      toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid to date format');
      }
      // If the input is just date-only string like YYYY-MM-DD, set to end of that day in UTC
      if (to.length === 10) {
        toDate.setUTCHours(23, 59, 59, 999);
      }
    }

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException(
        'The "from" date cannot be after the "to" date',
      );
    }

    return { fromDate, toDate };
  }

  private async resolveOutletScope(
    user: User,
    requestedOutletId?: string,
  ): Promise<OutletScopeResult> {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (requestedOutletId) {
        const outlet = await this.outletRepository.findOne({
          where: { id: requestedOutletId },
        });
        if (!outlet) {
          throw new NotFoundException('Outlet not found');
        }
        return { outlets: [outlet], targetOutletId: outlet.id };
      }

      const outlets = await this.outletRepository.find({
        order: { name: 'ASC' },
      });
      return { outlets };
    }

    if (user.role === UserRole.HQ_ADMIN) {
      if (!user.companyId) {
        throw new ForbiddenException('HQ Admin must belong to a company');
      }

      if (requestedOutletId) {
        const outlet = await this.outletRepository.findOne({
          where: { id: requestedOutletId, companyId: user.companyId },
        });
        if (!outlet) {
          throw new NotFoundException(
            'Outlet not found in user company',
          );
        }
        return { outlets: [outlet], targetOutletId: outlet.id };
      }

      const outlets = await this.outletRepository.find({
        where: { companyId: user.companyId },
        order: { name: 'ASC' },
      });
      return { outlets };
    }

    // Role is OUTLET_MANAGER or OUTLET_STAFF
    if (!user.outletId) {
      throw new ForbiddenException('No outlet assigned to this user');
    }

    if (requestedOutletId && requestedOutletId !== user.outletId) {
      throw new ForbiddenException(
        'Reports are limited to your assigned outlet',
      );
    }

    const outlet = await this.outletRepository.findOne({
      where: { id: user.outletId },
    });
    if (!outlet) {
      throw new NotFoundException('Assigned outlet not found');
    }

    return { outlets: [outlet], targetOutletId: outlet.id };
  }

  async getRevenueReport(
    userId: string,
    query: RevenueReportQueryDto,
  ): Promise<RevenueReportDataDto> {
    const user = await this.loadActiveUser(userId);
    const { outlets, targetOutletId } = await this.resolveOutletScope(
      user,
      query.outletId,
    );
    const { fromDate, toDate } = this.parseDateRange(query.from, query.to);

    if (outlets.length === 0) {
      return {
        from: query.from ?? null,
        to: query.to ?? null,
        summary: {
          totalRevenue: 0,
          totalSalesCount: 0,
          outletCount: 0,
        },
        outlets: [],
      };
    }

    const outletIds = outlets.map((o) => o.id);

    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .select('sale.outletId', 'outletId')
      .addSelect('COALESCE(SUM(sale.total), 0)', 'totalRevenue')
      .addSelect('COUNT(sale.id)', 'totalSalesCount')
      .where('sale.outletId IN (:...outletIds)', { outletIds })
      .andWhere('sale.paymentStatus = :paymentStatus', {
        paymentStatus: PaymentStatus.PAID,
      })
      .andWhere('sale.orderStatus != :orderStatus', {
        orderStatus: OrderStatus.CANCELLED,
      });

    if (fromDate) {
      qb.andWhere('sale.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('sale.createdAt <= :toDate', { toDate });
    }

    qb.groupBy('sale.outletId');

    const rawAggregates = await qb.getRawMany<{
      outletId: string;
      totalRevenue: string;
      totalSalesCount: string;
    }>();

    const aggregateMap = new Map<
      string,
      { totalRevenue: number; totalSalesCount: number }
    >();

    for (const row of rawAggregates) {
      aggregateMap.set(row.outletId, {
        totalRevenue: Number(row.totalRevenue) || 0,
        totalSalesCount: Number(row.totalSalesCount) || 0,
      });
    }

    const outletItems: OutletRevenueItemDto[] = outlets.map((outlet) => {
      const agg = aggregateMap.get(outlet.id) || {
        totalRevenue: 0,
        totalSalesCount: 0,
      };
      const revenue = Math.round(agg.totalRevenue * 100) / 100;
      const salesCount = agg.totalSalesCount;
      const aov =
        salesCount > 0 ? Math.round((revenue / salesCount) * 100) / 100 : 0;

      return {
        outletId: outlet.id,
        outletName: outlet.name,
        outletLocation: outlet.location ?? null,
        totalRevenue: revenue,
        totalSalesCount: salesCount,
        averageOrderValue: aov,
      };
    });

    // Sort by total revenue descending
    outletItems.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const overallTotalRevenue = outletItems.reduce(
      (sum, item) => sum + item.totalRevenue,
      0,
    );
    const overallSalesCount = outletItems.reduce(
      (sum, item) => sum + item.totalSalesCount,
      0,
    );

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      summary: {
        totalRevenue: Math.round(overallTotalRevenue * 100) / 100,
        totalSalesCount: overallSalesCount,
        outletCount: outletItems.length,
      },
      outlets: outletItems,
    };
  }

  async getTopItemsReport(
    userId: string,
    query: TopItemsReportQueryDto,
  ): Promise<TopItemsReportDataDto> {
    const user = await this.loadActiveUser(userId);
    const { outlets, targetOutletId } = await this.resolveOutletScope(
      user,
      query.outletId,
    );
    const { fromDate, toDate } = this.parseDateRange(query.from, query.to);
    const limit = query.limit && query.limit > 0 ? query.limit : 5;

    let targetOutlet: Outlet | undefined;
    if (targetOutletId) {
      targetOutlet = outlets.find((o) => o.id === targetOutletId);
    } else if (outlets.length === 1) {
      targetOutlet = outlets[0];
    }

    const scopeInfo = {
      outletId: targetOutlet ? targetOutlet.id : null,
      outletName: targetOutlet ? targetOutlet.name : null,
    };

    if (outlets.length === 0) {
      return {
        from: query.from ?? null,
        to: query.to ?? null,
        scope: scopeInfo,
        limit,
        totalItemsCount: 0,
        items: [],
      };
    }

    const outletIds = outlets.map((o) => o.id);

    const qb = this.saleItemRepository
      .createQueryBuilder('saleItem')
      .innerJoin('saleItem.sale', 'sale')
      .innerJoin('saleItem.menuItem', 'menuItem')
      .select('menuItem.id', 'menuItemId')
      .addSelect('menuItem.name', 'itemName')
      .addSelect('menuItem.category', 'category')
      .addSelect('menuItem.sku', 'sku')
      .addSelect('menuItem.basePrice', 'basePrice')
      .addSelect('COALESCE(SUM(saleItem.quantity), 0)', 'quantitySold')
      .addSelect('COALESCE(SUM(saleItem.lineTotal), 0)', 'totalRevenue')
      .where('sale.outletId IN (:...outletIds)', { outletIds })
      .andWhere('sale.paymentStatus = :paymentStatus', {
        paymentStatus: PaymentStatus.PAID,
      })
      .andWhere('sale.orderStatus != :orderStatus', {
        orderStatus: OrderStatus.CANCELLED,
      });

    if (fromDate) {
      qb.andWhere('sale.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('sale.createdAt <= :toDate', { toDate });
    }

    qb.groupBy('menuItem.id')
      .addGroupBy('menuItem.name')
      .addGroupBy('menuItem.category')
      .addGroupBy('menuItem.sku')
      .addGroupBy('menuItem.basePrice')
      .orderBy('"quantitySold"', 'DESC')
      .addOrderBy('"totalRevenue"', 'DESC')
      .limit(limit);

    const rawRows = await qb.getRawMany<{
      menuItemId: string;
      itemName: string;
      category: string | null;
      sku: string;
      basePrice: string | number;
      quantitySold: string | number;
      totalRevenue: string | number;
    }>();

    const items: TopSellingItemDto[] = rawRows.map((row, index) => ({
      rank: index + 1,
      menuItemId: row.menuItemId,
      itemName: row.itemName,
      category: row.category ?? null,
      sku: row.sku,
      basePrice: Number(row.basePrice) || 0,
      quantitySold: Number(row.quantitySold) || 0,
      totalRevenue: Math.round(Number(row.totalRevenue) * 100) / 100,
    }));

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      scope: scopeInfo,
      limit,
      totalItemsCount: items.length,
      items,
    };
  }
}
