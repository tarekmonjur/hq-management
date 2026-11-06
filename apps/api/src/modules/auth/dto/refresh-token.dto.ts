import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
