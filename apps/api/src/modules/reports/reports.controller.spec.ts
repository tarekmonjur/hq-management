import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto.js';
import { TopItemsReportQueryDto } from './dto/top-items-report-query.dto.js';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: {
    getRevenueReport: ReturnType<typeof vi.fn>;
    getTopItemsReport: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getRevenueReport: vi.fn(),
      getTopItemsReport: vi.fn(),
    };
    controller = new ReportsController(service as unknown as ReportsService);
  });

  describe('getRevenueReport', () => {
    it('should return wrapped revenue report response with 200 OK', async () => {
      const mockResult = {
        from: '2026-11-01',
        to: '2026-11-07',
        summary: {
          totalRevenue: 5000,
          totalSalesCount: 20,
          outletCount: 1,
        },
        outlets: [
          {
            outletId: 'outlet-1',
            outletName: 'Branch 1',
            outletLocation: 'Dhaka',
            totalRevenue: 5000,
            totalSalesCount: 20,
            averageOrderValue: 250,
          },
        ],
      };

      service.getRevenueReport.mockResolvedValue(mockResult);

      const query: RevenueReportQueryDto = { outletId: 'outlet-1' };
      const response = await controller.getRevenueReport(
        { sub: 'user-1' } as never,
        query,
      );

      expect(service.getRevenueReport).toHaveBeenCalledWith('user-1', query);
      expect(response).toEqual({
        statusCode: HttpStatus.OK,
        message: 'Revenue report fetched successfully',
        data: mockResult,
      });
    });
  });

  describe('getTopItemsReport', () => {
    it('should return wrapped top items report response with 200 OK', async () => {
      const mockResult = {
        from: null,
        to: null,
        scope: {
          outletId: 'outlet-1',
          outletName: 'Branch 1',
        },
        limit: 5,
        totalItemsCount: 1,
        items: [
          {
            rank: 1,
            menuItemId: 'item-1',
            itemName: 'Burger',
            category: 'Fast Food',
            sku: 'BUR-01',
            basePrice: 200,
            quantitySold: 50,
            totalRevenue: 10000,
          },
        ],
      };

      service.getTopItemsReport.mockResolvedValue(mockResult);

      const query: TopItemsReportQueryDto = { limit: 5 };
      const response = await controller.getTopItemsReport(
        { sub: 'user-1' } as never,
        query,
      );

      expect(service.getTopItemsReport).toHaveBeenCalledWith('user-1', query);
      expect(response).toEqual({
        statusCode: HttpStatus.OK,
        message: 'Top selling items report fetched successfully',
        data: mockResult,
      });
    });
  });
});
