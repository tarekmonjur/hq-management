import { QueryFailedError } from 'typeorm';

export interface PostgresDriverError {
  code?: string;
  constraint?: string;
}

function isPostgresDriverError(
  error: unknown,
): error is PostgresDriverError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (
    (!('code' in error) || typeof error.code === 'string') &&
    (!('constraint' in error) || typeof error.constraint === 'string')
  );
}

export function getPostgresDriverError(
  error: unknown,
): PostgresDriverError | null {
  if (!(error instanceof QueryFailedError)) {
    return null;
  }

  const driverError: unknown = error.driverError;
  return isPostgresDriverError(driverError) ? driverError : null;
}

export function hasConstraint(
  error: unknown,
  code: string,
  constraint: string,
): boolean {
  const driverError = getPostgresDriverError(error);
  return driverError?.code === code && driverError.constraint === constraint;
}
