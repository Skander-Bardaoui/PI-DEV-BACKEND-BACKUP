// src/accounts/services/accounts.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../entities/account.entity';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async create(businessId: string, dto: CreateAccountDto): Promise<Account> {
    if (dto.is_default) {
      await this.accountRepo.update(
        { business_id: businessId, is_default: true },
        { is_default: false },
      );
    }

    const account = this.accountRepo.create({
      ...dto,
      business_id: businessId,
      current_balance: dto.opening_balance ?? 0,
    });

    return this.accountRepo.save(account);
  }

  async findAll(businessId: string): Promise<Account[]> {
    return this.accountRepo.find({
      where: { business_id: businessId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id, business_id: businessId },
    });

    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<Account> {
    const account = await this.findOne(businessId, id);

    if (dto.is_default) {
      await this.accountRepo.update(
        { business_id: businessId, is_default: true },
        { is_default: false },
      );
    }

    // Destructure to handle balances explicitly:
    // - opening_balance is NEVER changed after creation
    // - current_balance is updated only if explicitly provided
    const { opening_balance, current_balance, ...safeDto } = dto as any;

    Object.assign(account, safeDto);

    if (current_balance !== undefined) {
      account.current_balance = current_balance;
    }

    return this.accountRepo.save(account);
  }

  async toggleActive(businessId: string, id: string): Promise<Account> {
    const account = await this.findOne(businessId, id);

    if (account.is_default && account.is_active) {
      throw new BadRequestException('Cannot deactivate the default account');
    }

    account.is_active = !account.is_active;
    return this.accountRepo.save(account);
  }

  async getBalance(businessId: string, id: string): Promise<{
    account: Account;
    current_balance: number;
    opening_balance: number;
  }> {
    const account = await this.findOne(businessId, id);
    return {
      account,
      current_balance: Number(account.current_balance),
      opening_balance: Number(account.opening_balance),
    };
  }

  async getTotalBalance(businessId: string): Promise<{
    total: number;
    by_account: { id: string; name: string; balance: number; type: string }[];
  }> {
    const accounts = await this.accountRepo.find({
      where: { business_id: businessId, is_active: true },
    });

    const by_account = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      balance: Number(a.current_balance),
      type: a.type,
    }));

    const total = by_account.reduce((sum, a) => sum + a.balance, 0);

    return { total, by_account };
  }
}
