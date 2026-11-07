import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  ApiBadRequestResponse as ApiBadRequestResponseDto,
  ApiForbiddenResponse as ApiForbiddenResponseDto,
  ApiNotFoundResponse as ApiNotFoundResponseDto,
  ApiUnauthorizedResponse as ApiUnauthorizedResponseDto,
} from '../../common/dto/api-error-response.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';
import { ListInventoriesQueryDto } from './dto/list-inventories-query.dto.js';
import {
  InventoryApiResponseDto,
  InventoryListApiResponseDto,
} from './dto/inventory-response.dto.js';
import { InventoriesService } from './inventories.service.js';

@ApiTags('inventories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventories')
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.HQ_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.OUTLET_MANAGER,
    UserRole.OUTLET_STAFF,
  )
  @ApiOperation({
    summary: 'List inventory stock',
    description:
      'HQ_ADMIN / SUPER_ADMIN see inventory across all outlets of their company. OUTLET_MANAGER / OUTLET_STAFF see only their own outlet inventory.',
  })
  @ApiOkResponse({ type: InventoryListApiResponseDto })
  @ApiBadRequestResponse({ type: ApiBadRequestResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  @ApiForbiddenResponse({ type: ApiForbiddenResponseDto })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListInventoriesQueryDto,
  ) {
    return this.inventoriesService.findAll(user.sub, query);
  }

  @Put(':inventoryId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HQ_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Adjust inventory stock',
    description:
      'Sets the absolute quantity for a specific inventory record. Restricted to HQ_ADMIN and SUPER_ADMIN.',
  })
  @ApiParam({ name: 'inventoryId', format: 'uuid' })
  @ApiOkResponse({ type: InventoryApiResponseDto })
  @ApiBadRequestResponse({ type: ApiBadRequestResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  @ApiForbiddenResponse({ type: ApiForbiddenResponseDto })
  @ApiNotFoundResponse({ type: ApiNotFoundResponseDto })
  adjustStock(
    @CurrentUser() user: JwtPayload,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() dto: AdjustInventoryDto,
  ) {
    return this.inventoriesService.adjustStock(user.sub, inventoryId, dto);
  }
}

