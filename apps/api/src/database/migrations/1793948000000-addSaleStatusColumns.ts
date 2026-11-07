import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleStatusColumns1793948000000 implements MigrationInterface {
  name = 'AddSaleStatusColumns1793948000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."sale_order_status" AS ENUM('OPEN', 'PREPARING', 'SERVED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sale_payment_status" AS ENUM('UNPAID', 'PAID', 'REFUNDED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD "table_no" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD "order_status" "public"."sale_order_status" NOT NULL DEFAULT 'SERVED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD "payment_status" "public"."sale_payment_status" NOT NULL DEFAULT 'PAID'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_outlet_status" ON "sales" ("outlet_id", "order_status", "payment_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_sales_outlet_status"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "payment_status"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "order_status"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "table_no"`);
    await queryRunner.query(`DROP TYPE "public"."sale_payment_status"`);
    await queryRunner.query(`DROP TYPE "public"."sale_order_status"`);
  }
}
