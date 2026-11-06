export function parseDurationToMs(duration: string): number {
  const match = duration.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    throw new Error(`Invalid duration string format: ${duration}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

export function parseDurationToSeconds(duration: string): number {
  return Math.floor(parseDurationToMs(duration) / 1000);
}

