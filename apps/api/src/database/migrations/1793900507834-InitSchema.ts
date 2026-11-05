import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1793900507834 implements MigrationInterface {
    name = 'InitSchema1793900507834'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."menu_items_unit_enum" AS ENUM('piece', 'kg', 'g', 'liter', 'ml', 'portion', 'serving', 'cup', 'bottle', 'can', 'pack', 'combo', 'set', 'box', 'bucket')`);
        await queryRunner.query(`CREATE TABLE "menu_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "description" text, "base_price" numeric(10,2) DEFAULT '0', "unit" "public"."menu_items_unit_enum", "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_menu_items_name" UNIQUE ("name"), CONSTRAINT "chk_menu_items_base_price" CHECK ("base_price" IS NULL OR "base_price" >= 0), CONSTRAINT "PK_57e6188f929e5dc6919168620c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "outlet_menu_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "outlet_id" uuid NOT NULL, "menu_item_id" uuid NOT NULL, "outlet_price" numeric(10,2), "is_active" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_outlet_menu_items_outlet_item" UNIQUE ("outlet_id", "menu_item_id"), CONSTRAINT "chk_outlet_menu_items_outlet_price" CHECK ("outlet_price" >= 0), CONSTRAINT "PK_6bb8039232a394fd3d40a86044c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_outlet_menu_items_menu_item" ON "outlet_menu_items"  ("menu_item_id") `);
        await queryRunner.query(`CREATE INDEX "idx_outlet_menu_items_outlet" ON "outlet_menu_items"  ("outlet_id") `);
        await queryRunner.query(`CREATE TABLE "inventories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "outlet_id" uuid NOT NULL, "menu_item_id" uuid NOT NULL, "quantity" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_inventories_outlet_item" UNIQUE ("outlet_id", "menu_item_id"), CONSTRAINT "chk_inventories_quantity_non_negative" CHECK ("quantity" >= 0), CONSTRAINT "PK_7b1946392ffdcb50cfc6ac78c0e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_inventories_menu_item" ON "inventories"  ("menu_item_id") `);
        await queryRunner.query(`CREATE INDEX "idx_inventories_outlet" ON "inventories"  ("outlet_id") `);
        await queryRunner.query(`CREATE TABLE "sale_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sale_id" uuid NOT NULL, "menu_item_id" uuid NOT NULL, "quantity" integer NOT NULL, "unit_price" numeric(12,2) NOT NULL, "line_total" numeric(12,2) NOT NULL, CONSTRAINT "chk_sale_items_prices_non_negative" CHECK ("unit_price" >= 0 AND "line_total" >= 0), CONSTRAINT "chk_sale_items_quantity_positive" CHECK ("quantity" > 0), CONSTRAINT "PK_5a7dc5b4562a9e590528b3e08ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_sale_items_menu_item" ON "sale_items"  ("menu_item_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sale_items_sale" ON "sale_items"  ("sale_id") `);
        await queryRunner.query(`CREATE TABLE "sales" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "outlet_id" uuid NOT NULL, "receipt_no" bigint NOT NULL, "total" numeric(12,2) NOT NULL, "idempotency_key" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_sales_outlet_idempotency" UNIQUE ("outlet_id", "idempotency_key"), CONSTRAINT "uq_sales_outlet_receipt" UNIQUE ("outlet_id", "receipt_no"), CONSTRAINT "chk_sales_receipt_positive" CHECK ("receipt_no" > 0), CONSTRAINT "chk_sales_total_non_negative" CHECK ("total" >= 0), CONSTRAINT "PK_4f0bc990ae81dba46da680895ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_sales_outlet_created" ON "sales"  ("outlet_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_sales_outlet" ON "sales"  ("outlet_id") `);
        await queryRunner.query(`CREATE TABLE "outlets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "code" character varying(20) NOT NULL, "name" character varying(255) NOT NULL, "location" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "UQ_690e0a878f58ecfb7c73a361ec3" UNIQUE ("code"), CONSTRAINT "uq_outlets_company_name" UNIQUE ("company_id", "name"), CONSTRAINT "uq_outlets_company_code" UNIQUE ("company_id", "code"), CONSTRAINT "PK_4f218ad1778c5c01d7bf77bab02" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_outlets_name" ON "outlets"  ("name") `);
        await queryRunner.query(`CREATE INDEX "idx_outlets_code" ON "outlets"  ("code") `);
        await queryRunner.query(`CREATE INDEX "idx_outlets_company" ON "outlets"  ("company_id") `);
        await queryRunner.query(`CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "UQ_3dacbb3eb4f095e29372ff8e131" UNIQUE ("name"), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "outlet_receipt_counters" ("outlet_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "last_number" bigint NOT NULL, CONSTRAINT "chk_receipt_counter_non_negative" CHECK ("last_number" >= 0), CONSTRAINT "PK_6645f11eca024c4b1b127bff31e" PRIMARY KEY ("outlet_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('HQ_ADMIN', 'OUTLET_MANAGER', 'OUTLET_STAFF')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "full_name" character varying(200) NOT NULL, "mobile_no" character varying(20), "role" "public"."user_role" NOT NULL, "outlet_id" uuid, "is_active" boolean NOT NULL DEFAULT true, "password_changed_at" TIMESTAMP, "last_login_at" TIMESTAMP WITH TIME ZONE, "failed_login_attempts" integer NOT NULL DEFAULT '0', "locked_until" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_users_email" UNIQUE ("email"), CONSTRAINT "chk_users_failed_attempts" CHECK ("failed_login_attempts" >= 0), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_users_failed_attempts" ON "users"  ("failed_login_attempts") `);
        await queryRunner.query(`CREATE INDEX "idx_users_outlet" ON "users"  ("outlet_id") `);
        await queryRunner.query(`CREATE TABLE "user_sessions" ("session_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "device_id" character varying(100), "device_name" character varying(100), "device_type" character varying(50), "os" character varying(100), "browser" character varying(100), "ip_address" inet, "user_agent" text, "issued_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP NOT NULL, "revoked_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP DEFAULT now(), CONSTRAINT "PK_b6c41d19165af4c69eba9ecda46" PRIMARY KEY ("session_id"))`);
        await queryRunner.query(`CREATE INDEX "uq_user_sessions_active_device" ON "user_sessions"  ("user_id", "device_id") WHERE "revoked_at" IS NULL AND "device_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_user_sessions_expires" ON "user_sessions"  ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "idx_user_sessions_user_active" ON "user_sessions"  ("user_id", "created_at") WHERE "revoked_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "idx_user_sessions_user" ON "user_sessions"  ("user_id") `);
        await queryRunner.query(`ALTER TABLE "outlet_menu_items" ADD CONSTRAINT "fk_outlet_menu_items_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outlet_menu_items" ADD CONSTRAINT "fk_outlet_menu_items_menu_item" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventories" ADD CONSTRAINT "fk_inventory_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventories" ADD CONSTRAINT "fk_inventory_menu_item" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD CONSTRAINT "fk_sale_items_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD CONSTRAINT "fk_sale_items_menu_item" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "fk_sales_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outlets" ADD CONSTRAINT "fk_outlet_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outlet_receipt_counters" ADD CONSTRAINT "fk_receipt_counters_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "fk_users_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "fk_user_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "fk_user_sessions_user"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "fk_users_outlet"`);
        await queryRunner.query(`ALTER TABLE "outlet_receipt_counters" DROP CONSTRAINT "fk_receipt_counters_outlet"`);
        await queryRunner.query(`ALTER TABLE "outlets" DROP CONSTRAINT "fk_outlet_company"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "fk_sales_outlet"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "fk_sale_items_menu_item"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "fk_sale_items_sale"`);
        await queryRunner.query(`ALTER TABLE "inventories" DROP CONSTRAINT "fk_inventory_menu_item"`);
        await queryRunner.query(`ALTER TABLE "inventories" DROP CONSTRAINT "fk_inventory_outlet"`);
        await queryRunner.query(`ALTER TABLE "outlet_menu_items" DROP CONSTRAINT "fk_outlet_menu_items_menu_item"`);
        await queryRunner.query(`ALTER TABLE "outlet_menu_items" DROP CONSTRAINT "fk_outlet_menu_items_outlet"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_sessions_user"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_sessions_user_active"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_sessions_expires"`);
        await queryRunner.query(`DROP INDEX "public"."uq_user_sessions_active_device"`);
        await queryRunner.query(`DROP TABLE "user_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_outlet"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_failed_attempts"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."user_role"`);
        await queryRunner.query(`DROP TABLE "outlet_receipt_counters"`);
        await queryRunner.query(`DROP TABLE "companies"`);
        await queryRunner.query(`DROP INDEX "public"."idx_outlets_company"`);
        await queryRunner.query(`DROP INDEX "public"."idx_outlets_code"`);
        await queryRunner.query(`DROP INDEX "public"."idx_outlets_name"`);
        await queryRunner.query(`DROP TABLE "outlets"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sales_outlet"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sales_outlet_created"`);
        await queryRunner.query(`DROP TABLE "sales"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sale_items_sale"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sale_items_menu_item"`);
        await queryRunner.query(`DROP TABLE "sale_items"`);
        await queryRunner.query(`DROP INDEX "public"."idx_inventories_outlet"`);
        await queryRunner.query(`DROP INDEX "public"."idx_inventories_menu_item"`);
        await queryRunner.query(`DROP TABLE "inventories"`);
        await queryRunner.query(`DROP INDEX "public"."idx_outlet_menu_items_outlet"`);
        await queryRunner.query(`DROP INDEX "public"."idx_outlet_menu_items_menu_item"`);
        await queryRunner.query(`DROP TABLE "outlet_menu_items"`);
        await queryRunner.query(`DROP TABLE "menu_items"`);
        await queryRunner.query(`DROP TYPE "public"."menu_items_unit_enum"`);
    }

}
