import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSupplierDto } from '../../Purchases/dto/create-supplier.dto';
import { QuerySuppliersDto, UpdateSupplierDto } from '../../Purchases/dto/update-supplier.dto';
import { Supplier } from '../../Purchases/entities/supplier.entity';
import { Repository, ILike } from 'typeorm';


@Injectable()
export class SuppliersService {

  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────
  async create(businessId: string, dto: CreateSupplierDto): Promise<Supplier> {

    const existing = await this.repo.findOne({
      where: { business_id: businessId, name: dto.name, is_active: true },
    });

    if (existing) {
      throw new ConflictException(
        `Un fournisseur actif nommé "${dto.name}" existe déjà.`,
      );
    }

    const supplier = this.repo.create({
      ...dto,
      business_id:   businessId,
      payment_terms: dto.payment_terms ?? 30,
      is_active:     true,
    });

    return this.repo.save(supplier);
  }

  // ─────────────────────────────────────────────────────────────
  // FIND ALL
  // ────────────────────────────────────────────────────────────

async findAll(businessId: string, query: QuerySuppliersDto) {
  const { search, category, page = 1, limit = 20 } = query;
const isActive = query.is_active; // peut être true, false, ou undefined

  const where: any[] = [];

  if (search) {
    // Chercher sur TOUS les attributs textuels
      const base: any = { business_id: businessId };
      if (isActive !== undefined) base.is_active = isActive;  
        where.push(
      { ...base, name:             ILike(`%${search}%`) },
      { ...base, matricule_fiscal: ILike(`%${search}%`) },
      { ...base, email:            ILike(`%${search}%`) },
      { ...base, phone:            ILike(`%${search}%`) },
      { ...base, category:         ILike(`%${search}%`) },
      { ...base, bank_name:        ILike(`%${search}%`) },
    );
  } else {
    const base: any = { business_id: businessId };
    if (isActive !== undefined) base.is_active = isActive;
    if (category) base.category = category;
    where.push(base);
  }

  const [data, total] = await this.repo.findAndCount({
    where,
    order: { name: 'ASC' },
    skip:  (page - 1) * limit,
    take:  limit,
  });

  return {
    data,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}


  // ─────────────────────────────────────────────────────────────
  // FIND ONE
  // ─────────────────────────────────────────────────────────────
  async findOne(businessId: string, id: string): Promise<Supplier> {
    const supplier = await this.repo.findOne({
      where: { id, business_id: businessId },
    });
    if (!supplier) {
      throw new NotFoundException(`Fournisseur introuvable (id: ${id})`);
    }
    return supplier;
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────
  async update(
    businessId: string,
    id: string,
    dto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.findOneOrFail(businessId, id);

    if (dto.name && dto.name !== supplier.name) {
      const dup = await this.repo.findOne({
        where: { business_id: businessId, name: dto.name, is_active: true },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException(
          `Un autre fournisseur nommé "${dto.name}" existe déjà.`,
        );
      }
    }

    Object.assign(supplier, dto);
    return this.repo.save(supplier);
  }

  // ─────────────────────────────────────────────────────────────
  // ARCHIVE (soft delete)
  // ─────────────────────────────────────────────────────────────
  async archive(businessId: string, id: string): Promise<{ message: string }> {
    const supplier = await this.findOneOrFail(businessId, id);

    if (!supplier.is_active) {
      throw new ConflictException('Ce fournisseur est déjà archivé.');
    }

    supplier.is_active = false;
    await this.repo.save(supplier);
    return { message: `Fournisseur "${supplier.name}" archivé.` };
  }

  // ─────────────────────────────────────────────────────────────
  // RESTORE
  // ─────────────────────────────────────────────────────────────
  async restore(businessId: string, id: string): Promise<Supplier> {
    const supplier = await this.findOneOrFail(businessId, id);

    if (supplier.is_active) {
      throw new ConflictException('Ce fournisseur est déjà actif.');
    }

    supplier.is_active = true;
    return this.repo.save(supplier);
  }

  // ─────────────────────────────────────────────────────────────
  // HELPER PUBLIC — utilisé par SupplierPOsService et PurchaseInvoicesService
  // ─────────────────────────────────────────────────────────────
  async findOneOrFail(businessId: string, id: string): Promise<Supplier> {
    const supplier = await this.repo.findOne({
      where: { id, business_id: businessId },
    });
    if (!supplier) {
      throw new NotFoundException(`Fournisseur introuvable (id: ${id})`);
    }
    return supplier;
  }
}