import { MigrationInterface, QueryRunner } from 'typeorm';

export class SwitchChatBillingModeToTokenUsage1774929600000
  implements MigrationInterface
{
  name = 'SwitchChatBillingModeToTokenUsage1774929600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_models"
      ALTER COLUMN "billingMode"
      SET DEFAULT 'token_usage_with_reserve';
    `);

    await queryRunner.query(`
      UPDATE "ai_models"
      SET "billingMode" = 'token_usage_with_reserve'
      WHERE "billingMode" IS NULL
         OR "billingMode" = 'flat_per_request';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "ai_models"
      SET "billingMode" = 'flat_per_request'
      WHERE "billingMode" = 'token_usage_with_reserve';
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_models"
      ALTER COLUMN "billingMode"
      SET DEFAULT 'flat_per_request';
    `);
  }
}
