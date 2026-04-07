import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatCreditCharges1774857600000
  implements MigrationInterface
{
  name = 'AddChatCreditCharges1774857600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_credit_charges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "clientRequestId" character varying(64) NOT NULL,
        "sessionId" uuid,
        "messageId" uuid,
        "modelId" character varying(100) NOT NULL,
        "billingMode" character varying(50) NOT NULL,
        "unitCredits" integer NOT NULL DEFAULT 0,
        "quantity" integer NOT NULL DEFAULT 1,
        "totalCredits" integer NOT NULL DEFAULT 0,
        "status" character varying(32) NOT NULL,
        "ruleSnapshot" jsonb,
        "failureReason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_credit_charges_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_credit_charges_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_chat_credit_charges_user_client_request_id"
      ON "chat_credit_charges" ("userId", "clientRequestId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_credit_charges_user_status"
      ON "chat_credit_charges" ("userId", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_chat_credit_charges_user_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_chat_credit_charges_user_client_request_id";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "chat_credit_charges";
    `);
  }
}
