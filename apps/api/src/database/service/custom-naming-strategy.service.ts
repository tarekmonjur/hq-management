import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';
import { snakeCase } from 'typeorm/browser/util/StringUtils.js';

export class CustomNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  // snake_case for tables
  tableName(className: string, customName: string): string {
    return customName ? customName : snakeCase(className);
  }

  // snake_case for columns
  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    const name = customName || propertyName;
    const prefix = embeddedPrefixes.concat('').join('_');
    return snakeCase(prefix + name);
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  // foreign‑key column name
  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  // helper
  private snakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
