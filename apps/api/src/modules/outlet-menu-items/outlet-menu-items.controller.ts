import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateOutletMenuItemDto } from './dto/create-outlet-menu-item.dto.js';
import { DeleteOutletMenuItemQueryDto } from './dto/delete-outlet-menu-item-query.dto.js';
import { ListOutletMenuItemsQueryDto } from './dto/list-outlet-menu-items-query.dto.js';
import {
  OutletMenuItemApiResponseDto,
  OutletMenuItemDeleteApiResponseDto,
  OutletMenuItemListApiResponseDto,
} from './dto/outlet-menu-item-response.dto.js';
import { UpdateOutletMenuItemPriceDto } from './dto/update-outlet-menu-item-price.dto.js';
import { OutletMenuItemsService } from './outlet-menu-items.service.js';

@ApiTags('outlet-menu-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HQ_ADMIN, UserRole.SUPER_ADMIN)
@Controller('outlet-menu-items')
export class OutletMenuItemsController {
  constructor(
    private readonly outletMenuItemsService: OutletMenuItemsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Assign a master menu item to an outlet' })
  @ApiCreatedResponse({ type: OutletMenuItemApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOutletMenuItemDto,
  ) {
    return this.outletMenuItemsService.create(user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List outlet menu assignments' })
  @ApiOkResponse({ type: OutletMenuItemListApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListOutletMenuItemsQueryDto,
  ) {
    return this.outletMenuItemsService.findAll(user.sub, query);
  }

  @Patch(':menuItemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an outlet menu price' })
  @ApiParam({ name: 'menuItemId', format: 'uuid' })
  @ApiOkResponse({ type: OutletMenuItemApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updatePrice(
    @CurrentUser() user: JwtPayload,
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
    @Body() dto: UpdateOutletMenuItemPriceDto,
  ) {
    return this.outletMenuItemsService.updatePrice(user.sub, menuItemId, dto);
  }

  @Delete(':menuItemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an outlet menu assignment' })
  @ApiParam({ name: 'menuItemId', format: 'uuid' })
  @ApiOkResponse({ type: OutletMenuItemDeleteApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
    @Query() query: DeleteOutletMenuItemQueryDto,
  ) {
    return this.outletMenuItemsService.remove(
      user.sub,
      menuItemId,
      query.outletId,
    );
  }
}
