import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradeKnowledgeChunksVectorAndTrgm1795400000000
  implements MigrationInterface
{
  name = 'UpgradeKnowledgeChunksVectorAndTrgm1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    const columnTypeRows = (await queryRunner.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'knowledge_chunks'
        AND column_name = 'embedding'
      LIMIT 1;
    `)) as Array<{ udt_name?: string }>;
    const currentUdt = columnTypeRows[0]?.udt_name;

    if (currentUdt !== 'vector') {
      await queryRunner.query(`
        ALTER TABLE "knowledge_chunks"
        ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1024);
      `);
      await queryRunner.query(`
        UPDATE "knowledge_chunks"
        SET "embedding_vec" = ("embedding"::real[])::vector(1024)
        WHERE "embedding" IS NOT NULL
          AND array_length("embedding", 1) = 1024;
      `);
      await queryRunner.query(`
        ALTER TABLE "knowledge_chunks"
        DROP COLUMN IF EXISTS "embedding";
      `);
      await queryRunner.query(`
        ALTER TABLE "knowledge_chunks"
        RENAME COLUMN "embedding_vec" TO "embedding";
      `);
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_knowledge_chunks_tsv";`);
    await queryRunner.query(`
      ALTER TABLE "knowledge_chunks"
      DROP COLUMN IF EXISTS "tsv";
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_embedding_hnsw"
      ON "knowledge_chunks"
      USING hnsw ("embedding" vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
      WHERE "isEnabled" = true AND "embedding" IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_content_trgm"
      ON "knowledge_chunks"
      USING gin ("content" gin_trgm_ops);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_user_kb_enabled"
      ON "knowledge_chunks" ("userId", "knowledgeBaseId", "isEnabled");
    `);

    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "progress" smallint NOT NULL DEFAULT 0;
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      ADD COLUMN IF NOT EXISTS "stage" character varying(32) NOT NULL DEFAULT 'queued';
    `);
    await queryRunner.query(`
      UPDATE "knowledge_documents"
      SET "progress" = 100, "stage" = 'completed'
      WHERE "status" = 'completed';
    `);
    await queryRunner.query(`
      UPDATE "knowledge_documents"
      SET "stage" = 'failed'
      WHERE "status" = 'failed';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_chunks_user_kb_enabled";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_chunks_content_trgm";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_chunks_embedding_hnsw";
    `);

    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      DROP COLUMN IF EXISTS "stage";
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_documents"
      DROP COLUMN IF EXISTS "progress";
    `);

    await queryRunner.query(`
      ALTER TABLE "knowledge_chunks"
      ADD COLUMN IF NOT EXISTS "tsv" tsvector;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_tsv"
      ON "knowledge_chunks" USING gin ("tsv");
    `);

    const columnTypeRows = (await queryRunner.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'knowledge_chunks'
        AND column_name = 'embedding'
      LIMIT 1;
    `)) as Array<{ udt_name?: string }>;
    if (columnTypeRows[0]?.udt_name === 'vector') {
      await queryRunner.query(`
        ALTER TABLE "knowledge_chunks"
        ADD COLUMN IF NOT EXISTS "embedding_arr" real[];
      `);
      await queryRunner.query(`
        UPDATE "knowledge_chunks"
        SET "embedding_arr" = "embedding"::real[]
        WHERE "embedding" IS NOT NULL;
      `);
      await queryRunner.query(`
        ALTER TABLE "knowledge_chunks"
        DROP COLUMN IF EXISTS "embedding";
      `);
      await queryRunner.query(`
        ALTER TABLE "knowledge_chunks"
        RENAME COLUMN "embedding_arr" TO "embedding";
      `);
    }
  }
}
