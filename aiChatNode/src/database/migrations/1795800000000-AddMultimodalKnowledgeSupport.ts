import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultimodalKnowledgeSupport1795800000000
  implements MigrationInterface
{
  name = 'AddMultimodalKnowledgeSupport1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_models"
      ADD COLUMN IF NOT EXISTS "supportsVision" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      UPDATE "ai_models"
      SET "supportsVision" = true
      WHERE "modelId" ILIKE 'gemini-%'
         OR "modelId" ILIKE 'glm-4v%'
         OR "modelId" ILIKE 'glm-4.6v%'
         OR "modelId" ILIKE '%vl%'
         OR "modelId" ILIKE '%vision%';
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_assets" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "knowledgeBaseId" uuid NOT NULL REFERENCES "knowledge_bases"("id") ON DELETE CASCADE,
        "documentId" uuid NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL,
        "assetType" varchar(32) NOT NULL,
        "pageNumber" int NULL,
        "storagePath" varchar(500) NOT NULL,
        "mimeType" varchar(64) NOT NULL DEFAULT 'image/webp',
        "width" int NOT NULL DEFAULT 0,
        "height" int NOT NULL DEFAULT 0,
        "sizeBytes" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_assets_doc_id"
      ON "knowledge_assets" ("documentId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_assets_kb_id"
      ON "knowledge_assets" ("knowledgeBaseId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_assets_kb_id";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_assets_doc_id";
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "knowledge_assets";
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_models"
      DROP COLUMN IF EXISTS "supportsVision";
    `);
  }
}
