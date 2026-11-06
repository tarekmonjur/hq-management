export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
