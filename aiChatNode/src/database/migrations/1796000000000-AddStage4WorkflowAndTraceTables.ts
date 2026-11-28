import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStage4WorkflowAndTraceTables1796000000000
  implements MigrationInterface
{
  name = 'AddStage4WorkflowAndTraceTables1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_workflows" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "description" text NULL,
        "status" varchar(24) NOT NULL DEFAULT 'draft',
        "version" int NOT NULL DEFAULT 1,
        "draftGraph" jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
        "publishedGraph" jsonb NULL,
        "publishedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_workflows_user_updated"
      ON "agent_workflows" ("userId", "updatedAt" DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_traces" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "traceId" varchar(64) NOT NULL UNIQUE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "source" varchar(32) NOT NULL DEFAULT 'web_chat',
        "workflowId" uuid NULL REFERENCES "agent_workflows"("id") ON DELETE SET NULL,
        "sessionId" uuid NULL,
        "channelInstanceId" uuid NULL,
        "roleId" uuid NULL,
        "title" varchar(160) NULL,
        "status" varchar(24) NOT NULL DEFAULT 'running',
        "durationMs" int NOT NULL DEFAULT 0,
        "totalPromptTokens" int NOT NULL DEFAULT 0,
        "totalCompletionTokens" int NOT NULL DEFAULT 0,
        "totalCredits" numeric(12, 4) NOT NULL DEFAULT 0,
        "errorSummary" text NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_traces_user_created"
      ON "agent_traces" ("userId", "createdAt" DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_traces_workflow_created"
      ON "agent_traces" ("workflowId", "createdAt" DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_traces_channel_created"
      ON "agent_traces" ("channelInstanceId", "createdAt" DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_spans" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "traceId" varchar(64) NOT NULL REFERENCES "agent_traces"("traceId") ON DELETE CASCADE,
        "spanId" varchar(64) NOT NULL,
        "parentSpanId" varchar(64) NULL,
        "nodeId" varchar(80) NULL,
        "spanType" varchar(32) NOT NULL,
        "name" varchar(160) NOT NULL,
        "modelId" varchar(120) NULL,
        "status" varchar(24) NOT NULL DEFAULT 'completed',
        "startedAt" bigint NOT NULL,
        "durationMs" int NOT NULL DEFAULT 0,
        "promptTokens" int NOT NULL DEFAULT 0,
        "completionTokens" int NOT NULL DEFAULT 0,
        "estimatedCredits" numeric(12, 4) NOT NULL DEFAULT 0,
        "inputSummary" text NULL,
        "outputSummary" text NULL,
        "metadata" jsonb NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agent_spans_trace_started"
      ON "agent_spans" ("traceId", "startedAt" ASC);
    `);

    await queryRunner.query(`
      ALTER TABLE "channel_config"
      ADD COLUMN IF NOT EXISTS "workflowId" uuid NULL REFERENCES "agent_workflows"("id") ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD COLUMN IF NOT EXISTS "traceId" varchar(64) NULL,
      ADD COLUMN IF NOT EXISTS "agentTimeline" jsonb NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_sessions"
      ADD COLUMN IF NOT EXISTS "activeRoleId" uuid NULL,
      ADD COLUMN IF NOT EXISTS "activeWorkflowId" uuid NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_sessions"
      DROP COLUMN IF EXISTS "activeWorkflowId",
      DROP COLUMN IF EXISTS "activeRoleId";
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      DROP COLUMN IF EXISTS "agentTimeline",
      DROP COLUMN IF EXISTS "traceId";
    `);
    await queryRunner.query(`
      ALTER TABLE "channel_config"
      DROP COLUMN IF EXISTS "workflowId";
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_agent_spans_trace_started";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_spans";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_agent_traces_channel_created";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_agent_traces_workflow_created";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_agent_traces_user_created";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_traces";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_agent_workflows_user_updated";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_workflows";`);
  }
}
