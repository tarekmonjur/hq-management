import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class RefreshTokenDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{43}$/, {
    message: 'refreshToken must be a 43-character base64url string',
  })
  refreshToken: string;
}
