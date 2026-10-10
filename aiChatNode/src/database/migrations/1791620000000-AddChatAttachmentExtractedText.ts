import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatAttachmentExtractedText1791620000000
  implements MigrationInterface
{
  name = 'AddChatAttachmentExtractedText1791620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_attachments"
      ADD COLUMN IF NOT EXISTS "extractedText" text,
      ADD COLUMN IF NOT EXISTS "charCount" integer;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_attachments"
      DROP COLUMN IF EXISTS "charCount",
      DROP COLUMN IF EXISTS "extractedText";
    `);
  }
}
