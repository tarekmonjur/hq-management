export interface SessionSummary {
  sessionId: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  issuedAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  isCurrent: boolean;
}

