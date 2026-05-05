import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelledToInvoiceStatus1743450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter la valeur CANCELLED à l'enum invoice_status_enum
    await queryRunner.query(`
      ALTER TYPE "invoice_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL ne permet pas de supprimer une valeur d'un enum directement
    // Il faudrait recréer l'enum et migrer les données, ce qui est complexe
    // Pour cette raison, on laisse la migration down vide
    // Si nécessaire, il faudra créer une migration manuelle pour supprimer la valeur
  }
}
