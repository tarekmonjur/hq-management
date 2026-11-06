import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DeleteOutletMenuItemQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  outletId: string;
}
