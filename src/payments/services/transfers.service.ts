import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account }         from '../entities/account.entity';
import { Transaction }     from '../entities/transaction.entity';
import { TransactionType } from '../enums/transaction-type.enum';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from '../../users/enums/role.enum';
import { PermissionUtil } from '../../businesses/utils/permission.util';
import { TransactionsService } from './transactions.service';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,

    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    @InjectRepository(BusinessMember)
    private readonly memberRepo: Repository<BusinessMember>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    private readonly dataSource: DataSource,
    private readonly transactionsService: TransactionsService,
  ) {}

  // Check if user has payment permission
  private async hasPaymentPermission(
    userId: string,
    businessId: string,
    permissionKey: string,
  ): Promise<boolean> {
    // First, check if user is a PLATFORM_ADMIN or BUSINESS_OWNER at the user level
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    // PLATFORM_ADMIN always has full access
    if (user.role === Role.PLATFORM_ADMIN) {
      return true;
    }

    // BUSINESS_OWNER: Check if they own the tenant that owns this business
    if (user.role === Role.BUSINESS_OWNER) {
      const tenant = await this.tenantRepo.findOne({
        where: { ownerId: userId },
      });

      if (tenant) {
        const business = await this.businessRepo.findOne({
          where: { id: businessId },
        });

        // If the business belongs to the tenant owned by this user, they have full access
        if (business && business.tenant_id === tenant.id) {
          return true;
        }
      }
    }

    // For other roles, check BusinessMember permissions
    const member = await this.memberRepo.findOne({
      where: { user_id: userId, business_id: businessId, is_active: true },
      relations: ['user'],
    });

    if (!member) {
      return false;
    }

    // BUSINESS_OWNER role in business_members table also has full access
    if (member.role === Role.BUSINESS_OWNER) {
      return true;
    }

    // Check granular permission
    return PermissionUtil.hasGranularPermission(
      member.payment_permissions,
      permissionKey,
    );
  }

  async create(businessId: string, userId: string, dto: any): Promise<{
    debit: Transaction;
    credit: Transaction;
  }> {
    // Check permission
    const hasPermission = await this.hasPaymentPermission(
      userId,
      businessId,
      'create_transfer',
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create transfers',
      );
    }

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

      // 6. Créer transaction DECAISSEMENT sur compte source avec fraud detection
      const debit = await this.transactionsService.create({
        business_id: businessId,
        account_id: dto.from_account_id,
        type: TransactionType.DECAISSEMENT,
        amount: dto.amount,
        transaction_date: new Date(dto.transfer_date),
        description,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        related_entity_type: 'Transfer',
        related_entity_id: dto.to_account_id,
        created_by: userId,
      });

      // 7. Créer transaction ENCAISSEMENT sur compte destination
      const credit = await this.transactionsService.create({
        business_id: businessId,
        account_id: dto.to_account_id,
        type: TransactionType.ENCAISSEMENT,
        amount: dto.amount,
        transaction_date: new Date(dto.transfer_date),
        description,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        related_entity_type: 'Transfer',
        related_entity_id: dto.from_account_id,
        created_by: userId,
      });

      return { debit, credit };
    });
  }
}
