import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RecurringInvoice } from '../../sales/entities/recurring-invoice.entity';
import { Account } from '../entities/account.entity';
import { TransactionsService } from './transactions.service';
import { TransactionType } from '../enums/transaction-type.enum';
import { EmailService } from '../../email/email.service';

@Injectable()
export class RecurringInvoicePaymentsService {
  private readonly logger = new Logger(RecurringInvoicePaymentsService.name);

  constructor(
    @InjectRepository(RecurringInvoice)
    private readonly recurringInvoiceRepo: Repository<RecurringInvoice>,

    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,

    private readonly transactionsService: TransactionsService,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {}

  // Get all recurring invoices for a business
  async findAll(businessId: string) {
    return this.recurringInvoiceRepo.find({
      where: { business_id: businessId },
      relations: ['client'],
      order: { created_at: 'DESC' },
    });
  }

  // Get single recurring invoice
  async findOne(businessId: string, id: string) {
    const recurringInvoice = await this.recurringInvoiceRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['client'],
    });

    if (!recurringInvoice) {
      throw new NotFoundException('Recurring invoice not found');
    }

    return recurringInvoice;
  }

  // Validate payment for recurring invoice
  async validatePayment(
    businessId: string,
    userId: string,
    recurringInvoiceId: string,
    dto: {
      account_id: string;
      payment_date: string;
      reference?: string;
      notes?: string;
    },
  ) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Get recurring invoice
      const recurringInvoice = await manager.findOne(RecurringInvoice, {
        where: { id: recurringInvoiceId, business_id: businessId },
        relations: ['client'],
      });

      if (!recurringInvoice) {
        throw new NotFoundException('Recurring invoice not found');
      }

      // 2. Verify account
      const account = await manager.findOne(Account, {
        where: { id: dto.account_id, business_id: businessId, is_active: true },
      });

      if (!account) {
        throw new NotFoundException('Account not found or inactive');
      }

      // 3. Calculate amount with discount
      let amount = Number(recurringInvoice.amount);
      if (recurringInvoice.discount_type && recurringInvoice.discount_value) {
        if (recurringInvoice.discount_type === 'PERCENTAGE') {
          amount = amount * (1 - Number(recurringInvoice.discount_value) / 100);
        } else if (recurringInvoice.discount_type === 'FIXED') {
          amount = Math.max(0, amount - Number(recurringInvoice.discount_value));
        }
      }

      // Add tax
      const taxAmount = amount * (Number(recurringInvoice.tax_rate) / 100);
      const totalAmount = amount + taxAmount;

      // 4. Update account balance
      account.current_balance = Number(account.current_balance) + totalAmount;
      await manager.save(account);

      // 5. Create transaction with fraud detection
      const transaction = await this.transactionsService.create({
        business_id: businessId,
        account_id: dto.account_id,
        type: TransactionType.ENCAISSEMENT,
        amount: totalAmount,
        transaction_date: new Date(dto.payment_date),
        description: `Paiement facture récurrente - ${recurringInvoice.description}`,
        reference: dto.reference || `REC-${recurringInvoice.id.substring(0, 8)}`,
        notes: dto.notes,
        related_entity_type: 'RecurringInvoice',
        related_entity_id: recurringInvoice.id,
        created_by: userId,
      });

      // 6. Update recurring invoice counters and next date
      recurringInvoice.invoices_generated += 1;
      recurringInvoice.last_generated_date = new Date(dto.payment_date);
      recurringInvoice.next_invoice_date = this.calculateNextDate(
        new Date(dto.payment_date),
        recurringInvoice.frequency,
      );
      await manager.save(recurringInvoice);

      this.logger.log(
        `Payment validated for recurring invoice ${recurringInvoiceId} - Amount: ${totalAmount} TND`,
      );

      return {
        message: 'Payment validated successfully',
        transaction,
        recurringInvoice,
        amount: totalAmount,
      };
    });
  }

  // Send reminder email to client
  async sendReminder(businessId: string, recurringInvoiceId: string) {
    const recurringInvoice = await this.findOne(businessId, recurringInvoiceId);

    if (!recurringInvoice.client) {
      throw new BadRequestException('Client information not found');
    }

    if (!recurringInvoice.client.email) {
      throw new BadRequestException('Client email not found');
    }

    // Calculate amount with discount
    let amount = Number(recurringInvoice.amount);
    if (recurringInvoice.discount_type && recurringInvoice.discount_value) {
      if (recurringInvoice.discount_type === 'PERCENTAGE') {
        amount = amount * (1 - Number(recurringInvoice.discount_value) / 100);
      } else if (recurringInvoice.discount_type === 'FIXED') {
        amount = Math.max(0, amount - Number(recurringInvoice.discount_value));
      }
    }

    const taxAmount = amount * (Number(recurringInvoice.tax_rate) / 100);
    const totalAmount = amount + taxAmount;

    // Send email reminder using the transporter directly (same pattern as other services)
    try {
      const frequencyLabels: Record<string, string> = {
        DAILY: 'quotidienne',
        WEEKLY: 'hebdomadaire',
        MONTHLY: 'mensuelle',
        QUARTERLY: 'trimestrielle',
        YEARLY: 'annuelle',
      };

      await this.emailService['transporter'].sendMail({
        from: `"BizManage" <${process.env.GMAIL_USER}>`,
        to: recurringInvoice.client.email,
        subject: `Rappel - Facture récurrente ${recurringInvoice.description}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 20px;">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin: 0;">BizManage</h1>
              </div>
              <h2 style="color: #333; margin-bottom: 20px;">Rappel de facture récurrente</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">Bonjour ${recurringInvoice.client.name},</p>
              <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
                Ceci est un rappel concernant votre facture récurrente <strong>${recurringInvoice.description}</strong>.
              </p>
              
              <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; padding: 20px; margin: 30px 0;">
                <h3 style="color: #333; margin-top: 0;">Détails de la facture :</h3>
                <table style="width: 100%; color: #666;">
                  <tr>
                    <td style="padding: 8px 0;"><strong>Description:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${recurringInvoice.description}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Fréquence:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${frequencyLabels[recurringInvoice.frequency] || recurringInvoice.frequency}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Montant HT:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${amount.toFixed(3)} TND</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>TVA (${recurringInvoice.tax_rate}%):</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${taxAmount.toFixed(3)} TND</td>
                  </tr>
                  <tr style="border-top: 2px solid #667eea;">
                    <td style="padding: 12px 0;"><strong style="font-size: 18px;">Total TTC:</strong></td>
                    <td style="padding: 12px 0; text-align: right;"><strong style="font-size: 18px; color: #667eea;">${totalAmount.toFixed(3)} TND</strong></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Prochaine échéance:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${new Date(recurringInvoice.next_invoice_date).toLocaleDateString('fr-FR')}</td>
                  </tr>
                </table>
              </div>

              ${recurringInvoice.notes ? `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #856404;"><strong>Note:</strong> ${recurringInvoice.notes}</p>
                </div>
              ` : ''}

              <p style="color: #666; line-height: 1.6; margin-top: 30px;">
                Merci de procéder au paiement avant la date d'échéance.
              </p>

              <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                Pour toute question, n'hésitez pas à nous contacter.
              </p>
            </div>
          </div>
        `,
      });

      this.logger.log(
        `Reminder email sent for recurring invoice ${recurringInvoiceId} to ${recurringInvoice.client.email}`,
      );

      return {
        message: 'Reminder email sent successfully',
        sentTo: recurringInvoice.client.email,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send reminder email for recurring invoice ${recurringInvoiceId}`,
        error,
      );
      throw new BadRequestException('Failed to send reminder email');
    }
  }

  // Calculate next invoice date based on frequency
  private calculateNextDate(currentDate: Date, frequency: string): Date {
    const next = new Date(currentDate);

    switch (frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'YEARLY':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }
}
