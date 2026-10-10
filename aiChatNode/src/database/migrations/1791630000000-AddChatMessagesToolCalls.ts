import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatMessagesToolCalls1791630000000
  implements MigrationInterface
{
  name = 'AddChatMessagesToolCalls1791630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD COLUMN IF NOT EXISTS "toolCalls" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      DROP COLUMN IF EXISTS "toolCalls";
    `);
  }
}
