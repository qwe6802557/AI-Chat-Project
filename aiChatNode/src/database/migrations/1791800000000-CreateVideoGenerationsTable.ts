import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideoGenerationsTable1791800000000
  implements MigrationInterface
{
  name = 'CreateVideoGenerationsTable1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "video_generations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "prompt" text NOT NULL,
        "modelId" character varying(100) NOT NULL DEFAULT 'Wan-AI/Wan2.2-T2V-A14B',
        "imageUrl" text,
        "aspectRatio" character varying(20) NOT NULL DEFAULT '16:9',
        "duration" integer NOT NULL DEFAULT 5,
        "videoUrl" text,
        "upstreamTaskId" character varying(100),
        "costCredits" integer NOT NULL DEFAULT 200,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "errorMessage" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_video_generations_id" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "idx_video_generations_user_id" ON "video_generations" ("userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "video_generations";
    `);
  }
}
