import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.config.get<string>('DB_HOST'),
      port: this.config.get<number>('DB_PORT'),
      username: this.config.get<string>('DB_USER'),
      password: this.config.get<string>('DB_PASSWORD'),
      database: this.config.get<string>('DB_NAME'),
      entities: [join(currentDir, 'entities', '*.entity.{ts,js}')],
      migrations: [join(currentDir, 'migrations', '*.{ts,js}')],
      // keep schema sync off – we’ll run migrations
      synchronize: false,
      // auto‑load migrations on app start (optional, see step 9)
      migrationsRun: false,
      // enable query logging only when you need it
      logging: this.config.get<string>('NODE_ENV') === 'development',
    };
  }
}
