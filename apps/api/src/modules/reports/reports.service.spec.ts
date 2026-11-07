import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { User } from '../../database/entities/user.entity.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { Outlet } from '../../database/entities/outlet.entity.js';
import { OrderStatus, PaymentStatus } from '../../common/enums/sale.enum.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let saleRepo: any;
  let saleItemRepo: any;
  let outletRepo: any;
  let userRepo: any;

  const mockSuperAdmin: Partial<User> = {
    id: 'super-admin-id',
    role: UserRole.SUPER_ADMIN,
    isActive: true,
  };

  const mockHqAdmin: Partial<User> = {
    id: 'hq-admin-id',
    role: UserRole.HQ_ADMIN,
    companyId: 'company-1',
    isActive: true,
  };

  const mockStaff: Partial<User> = {
    id: 'staff-id',
    role: UserRole.OUTLET_STAFF,
    companyId: 'company-1',
    outletId: 'outlet-1',
    isActive: true,
  };

  const mockOutlet1: Partial<Outlet> = {
    id: 'outlet-1',
    name: 'Outlet Dhanmondi',
    companyId: 'company-1',
    location: 'Dhanmondi',
  };

  const mockOutlet2: Partial<Outlet> = {
    id: 'outlet-2',
    name: 'Outlet Gulshan',
    companyId: 'company-1',
    location: 'Gulshan',
  };

  beforeEach(() => {
    saleRepo = {
      createQueryBuilder: vi.fn(),
    };
    saleItemRepo = {
      createQueryBuilder: vi.fn(),
    };
    outletRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
    };
    userRepo = {
      findOne: vi.fn(),
    };

    service = new ReportsService(
      saleRepo,
      saleItemRepo,
      outletRepo,
      userRepo,
    );
  });

  describe('User and Scope Validation', () => {
    it('should throw NotFoundException if user is not found or inactive', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getRevenueReport('unknown-id', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if HQ_ADMIN has no companyId', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'hq-admin-no-company',
        role: UserRole.HQ_ADMIN,
        isActive: true,
        companyId: null,
      });

      await expect(
        service.getRevenueReport('hq-admin-no-company', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if OUTLET_STAFF has no outlet assigned', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'staff-no-outlet',
        role: UserRole.OUTLET_STAFF,
        isActive: true,
        outletId: null,
      });

      await expect(
        service.getRevenueReport('staff-no-outlet', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if OUTLET_STAFF requests a different outletId', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff);

      await expect(
        service.getRevenueReport('staff-id', { outletId: 'different-outlet' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if requested outlet is not found in HQ_ADMIN company', async () => {
      userRepo.findOne.mockResolvedValue(mockHqAdmin);
      outletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getRevenueReport('hq-admin-id', { outletId: 'outlet-99' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if date range is invalid (from > to)', async () => {
      userRepo.findOne.mockResolvedValue(mockSuperAdmin);
      outletRepo.find.mockResolvedValue([mockOutlet1]);

      await expect(
        service.getRevenueReport('super-admin-id', {
          from: '2026-11-10',
          to: '2026-11-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if date string cannot be parsed', async () => {
      userRepo.findOne.mockResolvedValue(mockSuperAdmin);
      outletRepo.find.mockResolvedValue([mockOutlet1]);

      await expect(
        service.getRevenueReport('super-admin-id', {
          from: 'invalid-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRevenueReport', () => {
    it('should aggregate revenue for multiple outlets for HQ_ADMIN and include zero-revenue outlets', async () => {
      userRepo.findOne.mockResolvedValue(mockHqAdmin);
      outletRepo.find.mockResolvedValue([mockOutlet1, mockOutlet2]);

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { outletId: 'outlet-1', totalRevenue: '2500.50', totalSalesCount: '10' },
        ]),
      };
      saleRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getRevenueReport('hq-admin-id', {
        from: '2026-11-01',
        to: '2026-11-07',
      });

      expect(outletRepo.find).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        order: { name: 'ASC' },
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'sale.outletId IN (:...outletIds)',
        { outletIds: ['outlet-1', 'outlet-2'] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'sale.paymentStatus = :paymentStatus',
        { paymentStatus: PaymentStatus.PAID },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'sale.orderStatus != :orderStatus',
        { orderStatus: OrderStatus.CANCELLED },
      );

      expect(result.summary.totalRevenue).toBe(2500.5);
      expect(result.summary.totalSalesCount).toBe(10);
      expect(result.summary.outletCount).toBe(2);

      // Outlet 1 has sales
      const item1 = result.outlets.find((o) => o.outletId === 'outlet-1');
      expect(item1).toBeDefined();
      expect(item1?.totalRevenue).toBe(2500.5);
      expect(item1?.totalSalesCount).toBe(10);
      expect(item1?.averageOrderValue).toBe(250.05);

      // Outlet 2 has 0 sales
      const item2 = result.outlets.find((o) => o.outletId === 'outlet-2');
      expect(item2).toBeDefined();
      expect(item2?.totalRevenue).toBe(0);
      expect(item2?.totalSalesCount).toBe(0);
      expect(item2?.averageOrderValue).toBe(0);
    });

    it('should return empty summary when no outlets exist', async () => {
      userRepo.findOne.mockResolvedValue(mockSuperAdmin);
      outletRepo.find.mockResolvedValue([]);

      const result = await service.getRevenueReport('super-admin-id', {});

      expect(result.summary.totalRevenue).toBe(0);
      expect(result.summary.outletCount).toBe(0);
      expect(result.outlets).toHaveLength(0);
    });
  });

  describe('getTopItemsReport', () => {
    it('should return top items ranked by quantity and revenue with limit', async () => {
      userRepo.findOne.mockResolvedValue(mockStaff);
      outletRepo.findOne.mockResolvedValue(mockOutlet1);

      const mockQueryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        addGroupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          {
            menuItemId: 'item-1',
            itemName: 'Classic Burger',
            category: 'Burgers',
            sku: 'BUR-01',
            basePrice: '250',
            quantitySold: '30',
            totalRevenue: '7500',
          },
          {
            menuItemId: 'item-2',
            itemName: 'French Fries',
            category: 'Sides',
            sku: 'SIDE-01',
            basePrice: '120',
            quantitySold: '25',
            totalRevenue: '3000',
          },
        ]),
      };
      saleItemRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTopItemsReport('staff-id', {
        limit: 5,
        from: '2026-11-01',
        to: '2026-11-07',
      });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
      expect(result.scope.outletId).toBe('outlet-1');
      expect(result.scope.outletName).toBe('Outlet Dhanmondi');
      expect(result.limit).toBe(5);
      expect(result.totalItemsCount).toBe(2);
      expect(result.items[0]).toEqual({
        rank: 1,
        menuItemId: 'item-1',
        itemName: 'Classic Burger',
        category: 'Burgers',
        sku: 'BUR-01',
        basePrice: 250,
        quantitySold: 30,
        totalRevenue: 7500,
      });
      expect(result.items[1].rank).toBe(2);
    });
  });
});
