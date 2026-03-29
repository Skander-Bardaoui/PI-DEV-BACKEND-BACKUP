import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account }         from '../entities/account.entity';
import { Transaction }     from '../entities/transaction.entity';
import { TransactionType } from '../enums/transaction-type.enum';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, userId: string, dto: any): Promise<{
    debit: Transaction;
    credit: Transaction;
  }> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Vérifier compte source
      const fromAccount = await manager.findOne(Account, {
        where: { id: dto.from_account_id, business_id: businessId, is_active: true },
      });
      if (!fromAccount) throw new NotFoundException('Source account not found or inactive');

      // 2. Vérifier compte destination
      const toAccount = await manager.findOne(Account, {
        where: { id: dto.to_account_id, business_id: businessId, is_active: true },
      });
      if (!toAccount) throw new NotFoundException('Destination account not found or inactive');

      // 3. Vérifier solde suffisant
      if (Number(fromAccount.current_balance) < dto.amount) {
        throw new BadRequestException(
          `Solde insuffisant. Disponible: ${fromAccount.current_balance}`,
        );
      }

      // 4. Débiter le compte source
      fromAccount.current_balance = Number(fromAccount.current_balance) - dto.amount;
      await manager.save(Account, fromAccount);

      // 5. Créditer le compte destination
      toAccount.current_balance = Number(toAccount.current_balance) + dto.amount;
      await manager.save(Account, toAccount);

      const description = `Virement de ${fromAccount.name} vers ${toAccount.name}`;

      // 6. Créer transaction DECAISSEMENT sur compte source
      const debit = manager.create(Transaction, {
        business_id: businessId,
        account_id: dto.from_account_id,
        type: TransactionType.DECAISSEMENT,
        amount: dto.amount,
        transaction_date: dto.transfer_date,
        description,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        related_entity_type: 'Transfer',
        related_entity_id: dto.to_account_id,
        is_reconciled: false,
        created_by: userId,
      });
      await manager.save(Transaction, debit);

      // 7. Créer transaction ENCAISSEMENT sur compte destination
      const credit = manager.create(Transaction, {
        business_id: businessId,
        account_id: dto.to_account_id,
        type: TransactionType.ENCAISSEMENT,
        amount: dto.amount,
        transaction_date: dto.transfer_date,
        description,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        related_entity_type: 'Transfer',
        related_entity_id: dto.from_account_id,
        is_reconciled: false,
        created_by: userId,
      });
      await manager.save(Transaction, credit);

      return { debit, credit };
    });
  }
}
