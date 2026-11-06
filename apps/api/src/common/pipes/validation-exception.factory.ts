import { BadRequestException, HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export type FieldErrorMessages = Record<string, string[]>;

export function validationExceptionFactory(errors: ValidationError[]) {
  return new BadRequestException({
    message: formatValidationErrors(errors),
    error: 'Bad Request',
    statusCode: HttpStatus.BAD_REQUEST,
  });
}

export function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldErrorMessages {
  const formatted: FieldErrorMessages = {};

  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      formatted[field] = Object.values(error.constraints).map((message) =>
        stripFieldPrefix(message, error.property),
      );
    }

    if (error.children?.length) {
      Object.assign(formatted, formatValidationErrors(error.children, field));
    }
  }

  return formatted;
}

function stripFieldPrefix(message: string, property: string): string {
  const prefix = `${property} `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}
