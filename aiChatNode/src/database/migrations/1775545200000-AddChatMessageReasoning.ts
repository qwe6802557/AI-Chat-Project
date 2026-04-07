import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatMessageReasoning1775545200000
  implements MigrationInterface
{
  name = 'AddChatMessageReasoning1775545200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD COLUMN IF NOT EXISTS "reasoning" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      DROP COLUMN IF EXISTS "reasoning";
    `);
  }
}
