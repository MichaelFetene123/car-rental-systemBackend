import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';

const DEFAULT_POOL_MAX = 5;
const DEFAULT_IDLE_TIMEOUT_MS = 60000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 30000;
const DEFAULT_KEEP_ALIVE_INITIAL_DELAY_MS = 10000;

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  const parsedValue =
    rawValue === undefined ? Number.NaN : Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return fallback;
  }

  return !['0', 'false', 'no', 'off'].includes(rawValue.toLowerCase());
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const poolConfig: PoolConfig = {
      connectionString,
      idleTimeoutMillis: readPositiveIntegerEnv(
        'PG_IDLE_TIMEOUT_MS',
        DEFAULT_IDLE_TIMEOUT_MS,
      ),
      connectionTimeoutMillis: readPositiveIntegerEnv(
        'PG_CONNECTION_TIMEOUT_MS',
        DEFAULT_CONNECTION_TIMEOUT_MS,
      ),
      max: readPositiveIntegerEnv('PG_POOL_MAX', DEFAULT_POOL_MAX),
      keepAlive: readBooleanEnv('PG_KEEP_ALIVE', true),
      keepAliveInitialDelayMillis: readPositiveIntegerEnv(
        'PG_KEEP_ALIVE_INITIAL_DELAY_MS',
        DEFAULT_KEEP_ALIVE_INITIAL_DELAY_MS,
      ),
    };

    if (readBooleanEnv('PG_SSL', true)) {
      poolConfig.ssl = {
        rejectUnauthorized: false,
      };
    }

    const pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      PrismaService.logger.error('Unexpected error on idle pg client', err);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    try {
      await this.pool.end();
    } catch (error) {
      PrismaService.logger.warn(
        `Failed to close PostgreSQL pool: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
