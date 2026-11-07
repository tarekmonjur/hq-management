import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto.js';
import { RevenueReportApiResponseDto } from './dto/revenue-report-response.dto.js';
import { TopItemsReportQueryDto } from './dto/top-items-report-query.dto.js';
import { TopItemsReportApiResponseDto } from './dto/top-items-report-response.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HQ_ADMIN,
    UserRole.OUTLET_MANAGER,
    UserRole.OUTLET_STAFF,
  )
  @ApiOperation({
    summary: 'Get total revenue by outlet for an optional date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue report fetched successfully',
    type: RevenueReportApiResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Outlet not found' })
  async getRevenueReport(
    @CurrentUser() user: JwtPayload,
    @Query() query: RevenueReportQueryDto,
  ) {
    const data = await this.reportsService.getRevenueReport(user.sub, query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Revenue report fetched successfully',
      data,
    };
  }

  @Get('top-items')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HQ_ADMIN,
    UserRole.OUTLET_MANAGER,
    UserRole.OUTLET_STAFF,
  )
  @ApiOperation({
    summary: 'Get top selling items per outlet or across scoped outlets',
  })
  @ApiResponse({
    status: 200,
    description: 'Top selling items report fetched successfully',
    type: TopItemsReportApiResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Outlet not found' })
  async getTopItemsReport(
    @CurrentUser() user: JwtPayload,
    @Query() query: TopItemsReportQueryDto,
  ) {
    const data = await this.reportsService.getTopItemsReport(user.sub, query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Top selling items report fetched successfully',
      data,
    };
  }
}
