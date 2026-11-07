import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { ListSalesQueryDto } from './dto/list-sales-query.dto.js';
import {
  SaleApiResponseDto,
  SaleListApiResponseDto,
} from './dto/sale-response.dto.js';
import { SalesService } from './sales.service.js';

const SALES_ROLES = [
  UserRole.HQ_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.OUTLET_MANAGER,
  UserRole.OUTLET_STAFF,
];

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(...SALES_ROLES)
  @ApiOperation({
    summary: 'Create a sale',
    description:
      'Creates a multi-item sale for an outlet, deducts stock, and assigns the next receipt number. HQ_ADMIN can sell for an outlet in their company. SUPER_ADMIN can sell for any outlet. Outlet roles can sell only for their assigned outlet. Price is taken from the outlet menu.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Optional key up to 64 characters. Repeating the same key for the same outlet returns the original sale.',
    schema: { type: 'string', maxLength: 64 },
  })
  @ApiCreatedResponse({ type: SaleApiResponseDto })
  @ApiOkResponse({
    type: SaleApiResponseDto,
    description: 'The sale already existed for this idempotency key',
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSaleDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.salesService.create(
      user.sub,
      dto,
      idempotencyKey,
    );
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.sale;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(...SALES_ROLES)
  @ApiOperation({
    summary: 'List sales history',
    description:
      'SUPER_ADMIN sees every company. HQ_ADMIN sees outlets in their company. OUTLET_MANAGER and OUTLET_STAFF see only their outlet. Supports search, filters, and pagination.',
  })
  @ApiOkResponse({ type: SaleListApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: ListSalesQueryDto) {
    return this.salesService.findAll(user.sub, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(...SALES_ROLES)
  @ApiOperation({
    summary: 'Get sale details',
    description:
      'Returns one sale when it is inside the caller scope. SUPER_ADMIN can read any sale, HQ_ADMIN can read sales in their company, and outlet roles can read sales for their outlet.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SaleApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.findOne(user.sub, id);
  }
}
