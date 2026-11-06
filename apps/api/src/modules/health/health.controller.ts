import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  HealthApiErrorResponseDto,
  HealthApiResponseDto,
} from './dto/health-response.dto.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck({ noCache: true, swaggerDocumentation: false })
  @ApiOperation({
    summary: 'Health check',
    description:
      'Pings the database and checks that disk usage on / stays under 90%.',
  })
  @ApiOkResponse({ type: HealthApiResponseDto })
  @ApiServiceUnavailableResponse({ type: HealthApiErrorResponseDto })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }
}
