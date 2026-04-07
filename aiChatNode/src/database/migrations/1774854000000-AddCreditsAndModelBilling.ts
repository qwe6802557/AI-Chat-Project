import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditsAndModelBilling1774854000000
  implements MigrationInterface
{
  name = 'AddCreditsAndModelBilling1774854000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_credit_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "availableCredits" integer NOT NULL DEFAULT 0,
        "reservedCredits" integer NOT NULL DEFAULT 0,
        "consumedCredits" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_credit_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_credit_accounts_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_user_credit_accounts_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_ledger" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "accountId" uuid NOT NULL,
        "type" character varying(32) NOT NULL,
        "deltaAvailable" integer NOT NULL DEFAULT 0,
        "deltaReserved" integer NOT NULL DEFAULT 0,
        "availableAfter" integer NOT NULL DEFAULT 0,
        "reservedAfter" integer NOT NULL DEFAULT 0,
        "businessType" character varying(64) NOT NULL,
        "businessId" character varying(128),
        "modelId" character varying(100),
        "sessionId" uuid,
        "messageId" uuid,
        "remark" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_ledger_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credit_ledger_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_credit_ledger_accountId" FOREIGN KEY ("accountId")
          REFERENCES "user_credit_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_credit_accounts_userId"
      ON "user_credit_accounts" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_credit_ledger_user_created_at"
      ON "credit_ledger" ("userId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_credit_ledger_business"
      ON "credit_ledger" ("businessType", "businessId");
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_models"
      ADD COLUMN IF NOT EXISTS "billingMode" character varying(50) NOT NULL DEFAULT 'flat_per_request';
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_models"
      ADD COLUMN IF NOT EXISTS "creditCost" integer NOT NULL DEFAULT 100;
    `);

    await queryRunner.query(`
      UPDATE "ai_models" AS model
      SET "creditCost" = CASE
        WHEN LOWER(model."modelId") LIKE '%claude%'
          AND EXISTS (
            SELECT 1
            FROM "ai_providers" provider
            WHERE provider."id" = model."providerId"
              AND LOWER(provider."name") = 'zaiwen'
          )
        THEN 200
        ELSE 100
      END;
    `);

    await queryRunner.query(`
      INSERT INTO "user_credit_accounts" (
        "userId",
        "availableCredits",
        "reservedCredits",
        "consumedCredits"
      )
      SELECT
        users."id",
        0,
        0,
        0
      FROM "users" users
      LEFT JOIN "user_credit_accounts" accounts
        ON accounts."userId" = users."id"
      WHERE accounts."id" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_models"
      DROP COLUMN IF EXISTS "creditCost";
    `);

    await queryRunner.query(`
      ALTER TABLE "ai_models"
      DROP COLUMN IF EXISTS "billingMode";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_credit_ledger_business";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_credit_ledger_user_created_at";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_user_credit_accounts_userId";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "credit_ledger";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "user_credit_accounts";
    `);
  }
}

