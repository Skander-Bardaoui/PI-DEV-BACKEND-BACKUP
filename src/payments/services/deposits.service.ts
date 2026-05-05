import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account } from '../entities/account.entity';
import { TransactionsService } from './transactions.service';
import { TransactionType } from '../enums/transaction-type.enum';

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly transactionsService: TransactionsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    businessId: string,
    userId: string,
    dto: {
      account_id: string;
      amount: number;
      description?: string;
      reference?: string;
      notes?: string;
      deposit_date?: string;
    },
  ) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Verify account exists and is active
      const account = await manager.findOne(Account, {
        where: { id: dto.account_id, business_id: businessId, is_active: true },
      });

      if (!account) {
        throw new NotFoundException('Account not found or inactive');
      }

      // 2. Update account balance (use string arithmetic to avoid floating-point issues)
      const currentBalance = parseFloat(account.current_balance.toString());
      const newBalance = currentBalance + dto.amount;
      
      // Validate the new balance is within PostgreSQL numeric limits (precision 15, scale 3)
      // Max value is 10^12 - 1 = 999,999,999,999.999
      if (Math.abs(newBalance) >= 1e12) {
        throw new BadRequestException('Balance would exceed maximum allowed value');
      }
      
      account.current_balance = newBalance as any;
      await manager.save(account);

      // 3. Create transaction with fraud detection
      const transaction = await this.transactionsService.create({
        business_id: businessId,
        account_id: dto.account_id,
        type: TransactionType.VIREMENT_INTERNE,
        amount: dto.amount,
        transaction_date: dto.deposit_date ? new Date(dto.deposit_date) : new Date(),
        description: dto.description || 'Dépôt sur compte',
        reference: dto.reference || `DEP-${Date.now()}`,
        notes: dto.notes,
        related_entity_type: 'Deposit',
        related_entity_id: undefined,
        created_by: userId,
      });

      this.logger.log(
        `Deposit of ${dto.amount} added to account ${account.name} (${account.id})`,
      );

      return {
        message: 'Deposit added successfully',
        transaction,
        account: {
          id: account.id,
          name: account.name,
          previous_balance: currentBalance,
          new_balance: newBalance,
        },
      };
    });
  }
}
