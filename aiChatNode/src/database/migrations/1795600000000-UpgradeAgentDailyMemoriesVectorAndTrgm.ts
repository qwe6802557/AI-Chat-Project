import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradeAgentDailyMemoriesVectorAndTrgm1795600000000
  implements MigrationInterface
{
  name = 'UpgradeAgentDailyMemoriesVectorAndTrgm1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    const columnTypeRows = (await queryRunner.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'agent_daily_memories'
        AND column_name = 'embedding'
      LIMIT 1;
    `)) as Array<{ udt_name?: string }>;
    const currentUdt = columnTypeRows[0]?.udt_name;

    if (currentUdt !== 'vector') {
      await queryRunner.query(`
        ALTER TABLE "agent_daily_memories"
        ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1024);
      `);
      await queryRunner.query(`
        UPDATE "agent_daily_memories"
        SET "embedding_vec" = ("embedding"::real[])::vector(1024)
        WHERE "embedding" IS NOT NULL
          AND array_length("embedding", 1) = 1024;
      `);
      await queryRunner.query(`
        ALTER TABLE "agent_daily_memories"
        DROP COLUMN IF EXISTS "embedding";
      `);
      await queryRunner.query(`
        ALTER TABLE "agent_daily_memories"
        RENAME COLUMN "embedding_vec" TO "embedding";
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_daily_memories_embedding_hnsw"
      ON "agent_daily_memories"
      USING hnsw ("embedding" vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
      WHERE "embedding" IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_daily_memories_content_trgm"
      ON "agent_daily_memories"
      USING gin ("content" gin_trgm_ops);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_daily_memories_user_created"
      ON "agent_daily_memories" ("userId", "createdAt" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_agent_daily_memories_user_created";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_agent_daily_memories_content_trgm";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_agent_daily_memories_embedding_hnsw";
    `);

    const columnTypeRows = (await queryRunner.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'agent_daily_memories'
        AND column_name = 'embedding'
      LIMIT 1;
    `)) as Array<{ udt_name?: string }>;

    if (columnTypeRows[0]?.udt_name === 'vector') {
      await queryRunner.query(`
        ALTER TABLE "agent_daily_memories"
        ADD COLUMN IF NOT EXISTS "embedding_arr" real[];
      `);
      await queryRunner.query(`
        UPDATE "agent_daily_memories"
        SET "embedding_arr" = "embedding"::real[]
        WHERE "embedding" IS NOT NULL;
      `);
      await queryRunner.query(`
        ALTER TABLE "agent_daily_memories"
        DROP COLUMN IF EXISTS "embedding";
      `);
      await queryRunner.query(`
        ALTER TABLE "agent_daily_memories"
        RENAME COLUMN "embedding_arr" TO "embedding";
      `);
    }
  }
}
