import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeBaseTables1791640000000
  implements MigrationInterface
{
  name = 'CreateKnowledgeBaseTables1791640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 知识库主体表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_bases" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "avatar" character varying(255),
        "documentCount" integer NOT NULL DEFAULT 0,
        "chunkCount" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_bases_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_bases_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_knowledge_bases_user_id" ON "knowledge_bases" ("userId");
    `);

    // 2. 知识库文档表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "knowledgeBaseId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "fileName" character varying(255) NOT NULL,
        "fileType" character varying(20) NOT NULL,
        "fileSize" integer NOT NULL,
        "filePath" character varying(500),
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "errorMessage" text,
        "chunkCount" integer NOT NULL DEFAULT 0,
        "charCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_documents_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_documents_kb" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_documents_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_knowledge_documents_kb_id" ON "knowledge_documents" ("knowledgeBaseId");
      CREATE INDEX IF NOT EXISTS "idx_knowledge_documents_user_id" ON "knowledge_documents" ("userId");
    `);

    // 3. 知识库切片表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "documentId" uuid NOT NULL,
        "knowledgeBaseId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "chunkIndex" integer NOT NULL,
        "content" text NOT NULL,
        "charCount" integer NOT NULL,
        "embedding" real[],
        "tsv" tsvector,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_chunks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_chunks_doc" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_chunks_kb" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_chunks_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_doc_id" ON "knowledge_chunks" ("documentId");
      CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_kb_id" ON "knowledge_chunks" ("knowledgeBaseId");
      CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_tsv" ON "knowledge_chunks" USING gin ("tsv");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_chunks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_documents";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_bases";`);
  }
}
