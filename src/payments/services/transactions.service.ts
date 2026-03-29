import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async findAll(businessId: string): Promise<Transaction[]> {
    return await this.transactionRepo.find({
      where: { business_id: businessId },
      relations: ['account'],
      order: { transaction_date: 'DESC' },
    });
  }

  async findByAccount(businessId: string, accountId: string): Promise<Transaction[]> {
    return await this.transactionRepo.find({
      where: { business_id: businessId, account_id: accountId },
      relations: ['account'],
      order: { transaction_date: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['account'],
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }
}
