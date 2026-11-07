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
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  ApiForbiddenResponse as ApiForbiddenResponseDto,
  ApiUnauthorizedResponse as ApiUnauthorizedResponseDto,
} from '../../common/dto/api-error-response.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ListOutletsQueryDto } from './dto/list-outlets-query.dto.js';
import { OutletListApiResponseDto } from './dto/outlet-response.dto.js';
import { OutletsService } from './outlets.service.js';

@ApiTags('outlets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HQ_ADMIN, UserRole.SUPER_ADMIN)
@Controller('outlets')
export class OutletsController {
  constructor(private readonly outletsService: OutletsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List outlets',
    description:
      'HQ_ADMIN sees outlets in their company. SUPER_ADMIN sees every outlet.',
  })
  @ApiOkResponse({ type: OutletListApiResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  @ApiForbiddenResponse({ type: ApiForbiddenResponseDto })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListOutletsQueryDto,
  ) {
    return this.outletsService.findCompanyOutlets(user.sub, query);
  }
}
