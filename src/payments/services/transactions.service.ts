import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction }           from '../entities/transaction.entity';
import { FraudDetectionService } from './fraud-detection.service';
import { TransactionType }       from '../enums/transaction-type.enum';

// Internal only — not exported, not used in controller
interface CreateTransactionDto {
  business_id:          string;
  account_id:           string;
  type:                 TransactionType;
  amount:               number;
  transaction_date:     Date;
  description?:         string;
  reference?:           string;
  notes?:               string;
  related_entity_type?: string;
  related_entity_id?:   string;
  created_by:           string;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly fraudDetection:  FraudDetectionService,
  ) {}

  // ── Read ────────────────────────────────────────────────────────────

  async findAll(businessId: string): Promise<Transaction[]> {
    return this.transactionRepo.find({
      where:     { business_id: businessId },
      relations: ['account'],
      order:     { transaction_date: 'DESC' },
    });
  }

  async findByAccount(
    businessId: string,
    accountId:  string,
  ): Promise<Transaction[]> {
    return this.transactionRepo.find({
      where:     { business_id: businessId, account_id: accountId },
      relations: ['account'],
      order:     { transaction_date: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionRepo.findOne({
      where:     { id, business_id: businessId },
      relations: ['account'],
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  // ── Create — called internally by PaymentsService / TransfersService ──

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    // 1. Fraud check before saving
    const fraud = await this.fraudDetection.evaluate({
      amount:           dto.amount,
      type:             dto.type,
      transaction_date: dto.transaction_date,
    });

    // 2. Block high-risk transactions
    if (fraud.action === 'block') {
      this.logger.error(
        `Transaction BLOCKED — amount: ${dto.amount}, score: ${fraud.fraud_score}, confidence: ${fraud.confidence}`
      );
      throw new ForbiddenException(
        `Transaction blocked due to high fraud risk (score: ${(fraud.fraud_score * 100).toFixed(0)}%). Please contact support if this is legitimate.`,
      );
    }

    // 3. Save with fraud metadata
    const tx = this.transactionRepo.create({
      ...dto,
      fraud_score:    fraud.fraud_score,
      is_fraud:       fraud.is_fraud,
      fraud_blocked:  false, // Will always be false here since 'block' throws exception above
      fraud_reviewed: false,
    });

    const saved = await this.transactionRepo.save(tx);

    // 4. Log flagged transactions for manual review
    if (fraud.action === 'flag') {
      this.logger.warn(
        `⚠️  Transaction ${saved.id} FLAGGED for review — ` +
        `amount: ${dto.amount} | score: ${fraud.fraud_score} | confidence: ${fraud.confidence}`
      );
    } else if (fraud.action === 'allow') {
      this.logger.log(
        `✅ Transaction ${saved.id} approved — score: ${fraud.fraud_score}`
      );
    }

    return saved;
  }

  // ── Training data for ML service ────────────────────────────────────

  async getTrainingData(businessId?: string): Promise<{
    amount:                   number;
    hour:                     number;
    is_weekend:               number;
    is_night:                 number;
    velocity_score:           number;
    geo_anomaly_score:        number;
    spending_deviation_score: number;
    is_fraud:                 number;
  }[]> {
    const qb = this.transactionRepo
      .createQueryBuilder('t')
      .where('t.fraud_reviewed = true');

    if (businessId) {
      qb.andWhere('t.business_id = :businessId', { businessId });
    }

    const transactions = await qb.getMany();

    return transactions.map((t) => {
      const date = new Date(t.transaction_date);
      const hour = date.getHours();
      return {
        amount:                   Number(t.amount),
        hour,
        is_weekend:               [0, 6].includes(date.getDay()) ? 1 : 0,
        is_night:                 (hour >= 22 || hour < 6) ? 1 : 0,
        velocity_score:           0,
        geo_anomaly_score:        0,
        spending_deviation_score: 0,
        is_fraud:                 t.is_fraud ? 1 : 0,
      };
    });
  }

  // ── Update fraud review status ──────────────────────────────────────

  async updateFraudReview(
    businessId: string,
    transactionId: string,
    isFraud: boolean,
  ): Promise<Transaction> {
    const transaction = await this.findOne(businessId, transactionId);
    
    transaction.is_fraud = isFraud;
    transaction.fraud_reviewed = true;
    
    const updated = await this.transactionRepo.save(transaction);
    
    this.logger.log(
      `Transaction ${transactionId} reviewed — marked as ${isFraud ? 'FRAUD' : 'LEGITIMATE'}`
    );
    
    return updated;
  }
}
