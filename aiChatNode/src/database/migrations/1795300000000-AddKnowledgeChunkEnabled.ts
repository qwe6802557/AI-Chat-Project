import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKnowledgeChunkEnabled1795300000000
  implements MigrationInterface
{
  name = 'AddKnowledgeChunkEnabled1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_chunks"
      ADD COLUMN IF NOT EXISTS "isEnabled" boolean NOT NULL DEFAULT true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_chunks"
      DROP COLUMN IF EXISTS "isEnabled";
    `);
  }
}
