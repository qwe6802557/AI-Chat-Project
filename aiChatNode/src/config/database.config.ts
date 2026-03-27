import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { buildDatabaseCoreOptions } from './database-options';

export default registerAs('database', (): TypeOrmModuleOptions => {
  return {
    ...buildDatabaseCoreOptions(process.env),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  };
});
