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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto.js';
import {
  MenuItemApiResponseDto,
  MenuItemDeleteApiResponseDto,
  MenuItemListApiResponseDto,
} from './dto/menu-item-response.dto.js';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';
import { MenuItemsService } from './menu-items.service.js';

@ApiTags('menu-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @Post()
  @Roles(UserRole.HQ_ADMIN)
  @ApiOperation({ summary: 'Create a menu item' })
  @ApiCreatedResponse({ type: MenuItemApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  create(@Body() dto: CreateMenuItemDto) {
    return this.menuItemsService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List menu items' })
  @ApiOkResponse({ type: MenuItemListApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  findAll(@Query() query: ListMenuItemsQueryDto) {
    return this.menuItemsService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a menu item by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MenuItemApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuItemsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.HQ_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a menu item' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MenuItemApiResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuItemsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.HQ_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a menu item' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MenuItemDeleteApiResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuItemsService.remove(id);
  }
}
