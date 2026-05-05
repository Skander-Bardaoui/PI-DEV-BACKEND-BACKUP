// src/sales/services/subscription-manage.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringSubscriptionToken } from '../entities/recurring-subscription-token.entity';
import { RecurringInvoice, RecurringInvoiceStatus } from '../entities/recurring-invoice.entity';

@Injectable()
export class SubscriptionManageService {
  constructor(
    @InjectRepository(RecurringSubscriptionToken)
    private readonly tokenRepo: Repository<RecurringSubscriptionToken>,

    @InjectRepository(RecurringInvoice)
    private readonly recurringRepo: Repository<RecurringInvoice>,
  ) {}

  async getSubscriptionData(token: string) {
    const subscriptionToken = await this.tokenRepo.findOne({
      where: { token },
      relations: [
        'recurringInvoice',
        'recurringInvoice.client',
        'recurringInvoice.business',
        'invoice',
      ],
    });

    if (!subscriptionToken) {
      throw new NotFoundException('Token invalide ou expiré');
    }

    if (subscriptionToken.used) {
      throw new BadRequestException('Ce lien a déjà été utilisé');
    }

    if (new Date() > subscriptionToken.expires_at) {
      throw new BadRequestException('Ce lien a expiré');
    }

    return {
      recurring: subscriptionToken.recurringInvoice,
      invoice: subscriptionToken.invoice,
      action: subscriptionToken.action,
      token: subscriptionToken.token,
    };
  }

  async continueSubscription(token: string) {
    const subscriptionToken = await this.tokenRepo.findOne({
      where: { token, action: 'continue' },
      relations: ['recurringInvoice'],
    });

    if (!subscriptionToken) {
      throw new NotFoundException('Token invalide');
    }

    if (subscriptionToken.used) {
      throw new BadRequestException('Ce lien a déjà été utilisé');
    }

    if (new Date() > subscriptionToken.expires_at) {
      throw new BadRequestException('Ce lien a expiré');
    }

    // Mark token as used
    subscriptionToken.used = true;
    await this.tokenRepo.save(subscriptionToken);

    // Ensure recurring invoice is active
    const recurring = subscriptionToken.recurringInvoice;
    if (recurring.status !== RecurringInvoiceStatus.ACTIVE) {
      recurring.status = RecurringInvoiceStatus.ACTIVE;
      await this.recurringRepo.save(recurring);
    }

    return {
      message: 'Abonnement confirmé avec succès',
      recurring,
    };
  }

  async cancelSubscription(token: string, reason: string) {
    const subscriptionToken = await this.tokenRepo.findOne({
      where: { token, action: 'cancel' },
      relations: ['recurringInvoice'],
    });

    if (!subscriptionToken) {
      throw new NotFoundException('Token invalide');
    }

    if (subscriptionToken.used) {
      throw new BadRequestException('Ce lien a déjà été utilisé');
    }

    if (new Date() > subscriptionToken.expires_at) {
      throw new BadRequestException('Ce lien a expiré');
    }

    // Mark token as used
    subscriptionToken.used = true;
    await this.tokenRepo.save(subscriptionToken);

    // Cancel recurring invoice
    const recurring = subscriptionToken.recurringInvoice;
    recurring.status = RecurringInvoiceStatus.INACTIVE;
    recurring.notes = (recurring.notes || '') + `\n\nAnnulé par le client: ${reason || 'Aucune raison fournie'}`;
    await this.recurringRepo.save(recurring);

    return {
      message: 'Abonnement annulé avec succès',
      recurring,
    };
  }
}
