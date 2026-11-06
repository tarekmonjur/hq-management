import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ListOutletsQueryDto } from './list-outlets-query.dto.js';

describe('ListOutletsQueryDto', () => {
  it('transforms pagination strings and trims search/filter values', async () => {
    const dto = plainToInstance(ListOutletsQueryDto, {
      page: '2',
      limit: '25',
      search: '  downtown ',
      code: ' OUT-001 ',
      location: ' Central ',
    });

    expect(dto).toMatchObject({
      page: 2,
      limit: 25,
      search: 'downtown',
      code: 'OUT-001',
      location: 'Central',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    { page: '0' },
    { page: '1.5' },
    { limit: '101' },
    { limit: 'nope' },
    { search: '   ' },
    { code: 'x'.repeat(21) },
    { location: 'x'.repeat(256) },
  ])('rejects invalid query parameters: %o', async (query) => {
    const dto = plainToInstance(ListOutletsQueryDto, query);

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('uses the default pagination values', () => {
    expect(plainToInstance(ListOutletsQueryDto, {})).toMatchObject({
      page: 1,
      limit: 20,
    });
  });
});
