import { HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';

import {
  formatValidationErrors,
  validationExceptionFactory,
} from './validation-exception.factory.js';

describe('formatValidationErrors', () => {
  it('groups constraint messages by field and drops the repeated field name', () => {
    const errors: ValidationError[] = [
      {
        property: 'email',
        constraints: {
          maxLength: 'email must be shorter than or equal to 255 characters',
          isEmail: 'email must be an email',
        },
        children: [],
      },
      {
        property: 'password',
        constraints: {
          isString: 'password must be a string',
        },
        children: [],
      },
    ];

    expect(formatValidationErrors(errors)).toEqual({
      email: [
        'must be shorter than or equal to 255 characters',
        'must be an email',
      ],
      password: ['must be a string'],
    });
  });

  it('uses the nested path for child properties', () => {
    const errors: ValidationError[] = [
      {
        property: 'address',
        children: [
          {
            property: 'city',
            constraints: {
              isString: 'city must be a string',
            },
            children: [],
          },
        ],
      },
    ];

    expect(formatValidationErrors(errors)).toEqual({
      'address.city': ['must be a string'],
    });
  });

  it('puts the field map on the bad request body', () => {
    const exception = validationExceptionFactory([
      {
        property: 'fullName',
        constraints: { isString: 'fullName must be a string' },
        children: [],
      },
    ]);

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toMatchObject({
      message: { fullName: ['must be a string'] },
    });
  });
});
