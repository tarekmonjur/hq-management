import 'dotenv/config';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CustomNamingStrategy } from './service/custom-naming-strategy.service.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(currentDir, '../../.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  logging: process.env.NODE_ENV === 'development',

  // Works for both ts-node (src) and compiled JS (dist)
  entities: [join(currentDir, 'entities', '**', '*.entity.{ts,js}')],
  migrations: [join(currentDir, 'migrations', '*.{ts,js}')],
  namingStrategy: new CustomNamingStrategy(),
  synchronize: false, // never true, schema changes go through migrations
  installExtensions: false, // we use gen_random_uuid() (built in since PG13)
};

export const AppDataSource = new DataSource(dataSourceOptions);
