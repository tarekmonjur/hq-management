import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    description: '43-character base64url refresh token',
    pattern: '^[A-Za-z0-9_-]{43}$',
    minLength: 43,
    maxLength: 43,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{43}$/, {
    message: 'refreshToken must be a 43-character base64url string',
  })
  refreshToken: string;
}
