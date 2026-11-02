import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentRoleTeamSupport1791860000000 implements MigrationInterface {
  name = 'AddAgentRoleTeamSupport1791860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_roles"
      ADD COLUMN IF NOT EXISTS "is_team" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "team_config" jsonb DEFAULT '{}';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_roles"
      DROP COLUMN IF EXISTS "team_config",
      DROP COLUMN IF EXISTS "is_team";
    `);
  }
}
