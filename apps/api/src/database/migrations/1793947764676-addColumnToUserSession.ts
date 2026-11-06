import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColumnToUserSession1793947764676 implements MigrationInterface {
    name = 'AddColumnToUserSession1793947764676'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "absolute_expires_at" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "absolute_expires_at"`);
    }

}
