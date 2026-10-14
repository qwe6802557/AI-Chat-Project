import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatSessionKnowledgeBaseIds1791850000000 implements MigrationInterface {
  name = 'AddChatSessionKnowledgeBaseIds1791850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_sessions"
      ADD COLUMN IF NOT EXISTS "knowledgeBaseIds" jsonb NOT NULL DEFAULT '[]';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_sessions"
      DROP COLUMN IF EXISTS "knowledgeBaseIds";
    `);
  }
}
