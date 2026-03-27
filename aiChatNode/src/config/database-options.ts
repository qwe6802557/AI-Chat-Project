import type { ConfigService } from '@nestjs/config';

type ConfigSource = Pick<ConfigService, 'get'> | NodeJS.ProcessEnv;

export interface DatabaseCoreOptions {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

const isConfigService = (
  source: ConfigSource,
): source is Pick<ConfigService, 'get'> => {
  return typeof source === 'object' && source !== null && 'get' in source;
};

const readConfig = (source: ConfigSource, key: string): string | undefined => {
  if (isConfigService(source)) {
    const value = source.get<string>(key);
    return typeof value === 'string' ? value : undefined;
  }

  return source[key];
};

const readBoolean = (source: ConfigSource, key: string): boolean => {
  return readConfig(source, key) === 'true';
};

const readNumber = (
  source: ConfigSource,
  key: string,
  fallback: number,
): number => {
  const rawValue = readConfig(source, key);
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

export const buildDatabaseCoreOptions = (
  source: ConfigSource,
): DatabaseCoreOptions => {
  const isProduction = readConfig(source, 'NODE_ENV') === 'production';

  return {
    type: 'postgres',
    host: readConfig(source, 'DB_HOST') || 'localhost',
    port: readNumber(source, 'DB_PORT', 5432),
    username: readConfig(source, 'DB_USERNAME') || 'postgres',
    password: readConfig(source, 'DB_PASSWORD') || 'postgres',
    database: readConfig(source, 'DB_DATABASE') || 'postgres',
    synchronize: readBoolean(source, 'DB_SYNCHRONIZE') && !isProduction,
    logging: readConfig(source, 'NODE_ENV') === 'development',
  };
};
