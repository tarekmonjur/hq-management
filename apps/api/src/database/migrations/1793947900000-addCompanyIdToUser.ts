import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyIdToUser1793947900000 implements MigrationInterface {
  name = 'AddCompanyIdToUser1793947900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "company_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_company" ON "users" ("company_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "fk_users_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "fk_users_company"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_users_company"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "company_id"`);
  }
}
