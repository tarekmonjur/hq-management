import { UserRole } from '../../../common/enums/user.enum.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
  outletId: string | null;
  companyId: string | null;
  jti: string;
}
