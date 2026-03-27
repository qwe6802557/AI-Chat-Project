import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1774317600000 implements MigrationInterface {
  name = 'InitSchema1774317600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'users_role_enum'
        ) THEN
          CREATE TYPE "users_role_enum" AS ENUM ('admin', 'user');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying(50) NOT NULL,
        "password" character varying(255) NOT NULL,
        "phone" character varying(20),
        "email" character varying(100) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'user',
        "preferences" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_providers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "accessCount" bigint NOT NULL DEFAULT 0,
        "description" text,
        "website" character varying(255),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_providers_name" UNIQUE ("name"),
        CONSTRAINT "PK_ai_providers_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_models" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "modelName" character varying(100) NOT NULL,
        "modelId" character varying(100) NOT NULL,
        "inputPrice" numeric(18, 6) NOT NULL DEFAULT 0,
        "outputPrice" numeric(18, 6) NOT NULL DEFAULT 0,
        "contextLength" integer NOT NULL DEFAULT 0,
        "maxOutput" integer NOT NULL DEFAULT 0,
        "availability" numeric(5, 2) NOT NULL DEFAULT 100,
        "tps" integer NOT NULL DEFAULT 0,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "providerId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_models_modelId" UNIQUE ("modelId"),
        CONSTRAINT "PK_ai_models_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_models_providerId" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL DEFAULT '新对话',
        "userId" uuid NOT NULL,
        "isArchived" boolean NOT NULL DEFAULT false,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "lastMessagePreview" text,
        "lastActiveAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_sessions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "userMessage" text NOT NULL,
        "aiMessage" text NOT NULL,
        "model" character varying(100),
        "usage" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_chat_messages_sessionId" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "sessionId" uuid,
        "messageId" uuid,
        "originalName" character varying(255) NOT NULL,
        "originalMime" character varying(100) NOT NULL,
        "storageMime" character varying(100) NOT NULL,
        "storagePath" character varying(500) NOT NULL,
        "sizeBytes" integer NOT NULL,
        "width" integer,
        "height" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_attachments_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_chat_attachments_sessionId" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_chat_attachments_messageId" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "ai_models"
      ALTER COLUMN "inputPrice" TYPE numeric(18, 6),
      ALTER COLUMN "outputPrice" TYPE numeric(18, 6);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_sessions_user_last_active_at"
      ON "chat_sessions" ("userId", "lastActiveAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_sessions_user_deleted_archived"
      ON "chat_sessions" ("userId", "isDeleted", "isArchived");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_session_created_at"
      ON "chat_messages" ("sessionId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_user_created_at"
      ON "chat_messages" ("userId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_attachments_user_message_id"
      ON "chat_attachments" ("userId", "messageId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_attachments_user_session_id"
      ON "chat_attachments" ("userId", "sessionId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chat_attachments_user_session_id";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chat_attachments_user_message_id";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chat_messages_user_created_at";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chat_messages_session_created_at";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chat_sessions_user_deleted_archived";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_chat_sessions_user_last_active_at";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_attachments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_sessions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_models";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_providers";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum";`);
  }
}
