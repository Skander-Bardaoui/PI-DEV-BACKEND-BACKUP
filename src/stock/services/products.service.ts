// src/stock/services/products.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, SelectQueryBuilder, Not, IsNull } from 'typeorm';
import Groq from 'groq-sdk';
import PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import { Product, ProductType } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ScanProductImageResponseDto } from '../dto/scan-product-image.dto';
import { ScanServiceDescriptionResponseDto } from '../dto/scan-service-description.dto';
import { GenerateSkuDto } from '../dto/generate-sku.dto';
import { QueryProductsDto, ProductSortBy } from '../dto/query-products.dto';
import { generateInternalBarcode } from '../utils/barcode.util';
import { Business } from '../../businesses/entities/business.entity';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from '../../users/enums/role.enum';
import { PermissionUtil } from '../../businesses/utils/permission.util';
import { AuditLogService } from '../../common/services/audit-log.service';
import { AuditAction, AuditEntityType } from '../../common/entities/audit-log.entity';

@Injectable()
export class ProductsService {
  private groq: Groq;

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly memberRepo: Repository<BusinessMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (apiKey) {
      this.groq = new Groq({ apiKey });
    }
  }

  // ─── Check if user has stock permission ──────────────────
  private async hasStockPermission(
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
      member.stock_permissions,
      permissionKey,
    );
  }

  async findAll(businessId: string, query: QueryProductsDto = {}, includeDeleted = false): Promise<Product[]> {
    const qb: SelectQueryBuilder<Product> = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.warehouse', 'warehouse')
      .where('product.business_id = :businessId', { businessId });

    // Exclude soft-deleted unless explicitly requested
    if (!includeDeleted) {
      qb.andWhere('product.deleted_at IS NULL');
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(product.name) LIKE LOWER(:search) OR LOWER(product.sku) LIKE LOWER(:search) OR LOWER(product.barcode) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    if (query.category_id) {
      qb.andWhere('product.category_id = :categoryId', { categoryId: query.category_id });
    }

    if (query.warehouse_id) {
      qb.andWhere('product.warehouse_id = :warehouseId', { warehouseId: query.warehouse_id });
    }

    if (query.is_active !== undefined) {
      qb.andWhere('product.is_active = :isActive', { isActive: query.is_active });
    }

    if (query.is_stockable !== undefined) {
      qb.andWhere('product.track_inventory = :trackInventory', { trackInventory: query.is_stockable });
    }

    if (query.low_stock) {
      qb.andWhere('product.track_inventory = :trackInventory', { trackInventory: true })
        .andWhere('product.quantity <= product.min_quantity');
    }

    if (query.out_of_stock) {
      qb.andWhere('product.quantity = :zero', { zero: 0 });
    }

    if (query.has_barcode !== undefined) {
      if (query.has_barcode) {
        qb.andWhere('product.barcode IS NOT NULL');
      } else {
        qb.andWhere('product.barcode IS NULL');
      }
    }

    if (query.price_min !== undefined) {
      qb.andWhere('product.price >= :priceMin', { priceMin: query.price_min });
    }

    if (query.price_max !== undefined) {
      qb.andWhere('product.price <= :priceMax', { priceMax: query.price_max });
    }

    if (query.type) {
      qb.andWhere('product.type = :type', { type: query.type });
    }

    const sortBy = query.sort_by || ProductSortBy.NAME;
    const sortOrder = query.sort_order || 'ASC';

    switch (sortBy) {
      case ProductSortBy.NAME:
        qb.orderBy('product.name', sortOrder);
        break;
      case ProductSortBy.PRICE:
        qb.orderBy('product.price', sortOrder);
        break;
      case ProductSortBy.QUANTITY:
        qb.orderBy('product.quantity', sortOrder);
        break;
      case ProductSortBy.CREATED_AT:
        qb.orderBy('product.created_at', sortOrder);
        break;
      default:
        qb.orderBy('product.name', 'ASC');
    }

    return qb.getMany();
  }

  async findOne(businessId: string, id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['category', 'default_supplier'],
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async findAlerts(businessId: string): Promise<Product[]> {
    return this.productRepo
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.track_inventory = :track', { track: true })
      .andWhere('product.quantity <= product.min_quantity')
      .andWhere('product.is_active = :active', { active: true })
      .leftJoinAndSelect('product.category', 'category')
      .orderBy('product.name', 'ASC')
      .getMany();
  }

  async create(businessId: string, dto: CreateProductDto, userId?: string): Promise<Product> {
    // Check stock CREATE permission based on product type
    if (userId) {
      const isService = dto.type === ProductType.SERVICE;
      const permissionKey = isService ? 'create_service' : 'create_product';
      const hasPermission = await this.hasStockPermission(userId, businessId, permissionKey);
      if (!hasPermission) {
        throw new ForbiddenException(`You do not have permission to create ${isService ? 'services' : 'products'}`);
      }
    }

    if (dto.type === ProductType.SERVICE || dto.type === ProductType.DIGITAL) {
      dto.track_inventory = false;
      dto.quantity = 0;
      dto.min_quantity = 0;
      dto.warehouse_id = undefined;
    }

    const product = this.productRepo.create({
      ...dto,
      business_id: businessId,
      created_by: userId,
      updated_by: userId,
    });
    
    const saved = await this.productRepo.save(product);

    // Log creation
    if (userId) {
      await this.auditLogService.log({
        business_id: businessId,
        action: AuditAction.CREATE,
        entity_type: AuditEntityType.PRODUCT,
        entity_id: saved.id,
        entity_name: saved.name,
        performed_by: userId,
        new_value: saved,
      });
    }

    return saved;
  }

  async update(businessId: string, id: string, dto: UpdateProductDto, userId?: string): Promise<Product> {
    const product = await this.findOne(businessId, id);
    
    // Check stock UPDATE permission based on product type
    if (userId) {
      const isService = product.type === ProductType.SERVICE;
      const permissionKey = isService ? 'update_service' : 'update_product';
      const hasPermission = await this.hasStockPermission(userId, businessId, permissionKey);
      if (!hasPermission) {
        throw new ForbiddenException(`You do not have permission to update ${isService ? 'services' : 'products'}`);
      }
    }

    const oldValue = { ...product };

    if (dto.type === ProductType.SERVICE || dto.type === ProductType.DIGITAL) {
      dto.track_inventory = false;
      dto.quantity = 0;
      dto.min_quantity = 0;
      dto.warehouse_id = undefined;
    }

    Object.assign(product, dto);
    if (userId) {
      product.updated_by = userId;
    }
    
    const saved = await this.productRepo.save(product);

    // Log update
    if (userId) {
      await this.auditLogService.log({
        business_id: businessId,
        action: AuditAction.UPDATE,
        entity_type: AuditEntityType.PRODUCT,
        entity_id: saved.id,
        entity_name: saved.name,
        performed_by: userId,
        old_value: oldValue,
        new_value: saved,
      });
    }

    return saved;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const product = await this.findOne(businessId, id);
    await this.productRepo.remove(product);
  }

  async softDelete(businessId: string, id: string, userId: string): Promise<Product> {
    const product = await this.findOne(businessId, id);
    
    // Check stock DELETE permission based on product type
    const isService = product.type === ProductType.SERVICE;
    const permissionKey = isService ? 'delete_service' : 'delete_product';
    const hasPermission = await this.hasStockPermission(userId, businessId, permissionKey);
    if (!hasPermission) {
      throw new ForbiddenException(`You do not have permission to delete ${isService ? 'services' : 'products'}`);
    }

    product.deleted_at = new Date();
    product.deleted_by = userId;

    const saved = await this.productRepo.save(product);

    // Log deletion
    await this.auditLogService.log({
      business_id: businessId,
      action: AuditAction.DELETE,
      entity_type: AuditEntityType.PRODUCT,
      entity_id: saved.id,
      entity_name: saved.name,
      performed_by: userId,
      description: `Product soft deleted: ${saved.name}`,
    });

    return saved;
  }

  async restore(businessId: string, id: string, userId: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['category', 'warehouse'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (!product.deleted_at) {
      throw new NotFoundException('Product is not deleted');
    }

    product.deleted_at = null;
    product.deleted_by = null;
    product.updated_by = userId;

    const saved = await this.productRepo.save(product);

    // Log restoration
    await this.auditLogService.log({
      business_id: businessId,
      action: AuditAction.RESTORE,
      entity_type: AuditEntityType.PRODUCT,
      entity_id: saved.id,
      entity_name: saved.name,
      performed_by: userId,
      description: `Product restored: ${saved.name}`,
    });

    return saved;
  }

  async findArchived(businessId: string): Promise<Product[]> {
    return this.productRepo.find({
      where: {
        business_id: businessId,
        deleted_at: Not(IsNull()),
      },
      relations: ['category', 'warehouse'],
      order: { deleted_at: 'DESC' },
    });
  }

  // ==================== Product image upload ====================
  async uploadImage(businessId: string, id: string, imageBuffer: Buffer, mimeType: string): Promise<Product> {
    const product = await this.findOne(businessId, id);
    const base64 = imageBuffer.toString('base64');
    product.image_url = `data:${mimeType};base64,${base64}`;
    return this.productRepo.save(product);
  }

  async removeImage(businessId: string, id: string): Promise<Product> {
    const product = await this.findOne(businessId, id);
    product.image_url = null;
    return this.productRepo.save(product);
  }
  // ==============================================================

  async scanProductImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ScanProductImageResponseDto> {
    if (!this.groq) {
      throw new Error('Groq API key not configured. Please add GROQ_API_KEY to your .env file.');
    }

    const base64Image = imageBuffer.toString('base64');

    const prompt = `You are analyzing a product image to extract information for inventory management.

Extract ONLY what is clearly visible in the image. Return a JSON object with these exact fields:
- name: product name (string or null)
- description: brief product description (string or null)
- barcode: the numeric string printed under a barcode if visible (string or null)
- unit: unit of measure like "kg", "L", "pcs", "box" (string or null)
- suggested_category_name: a plain text category guess like "Electronics", "Food", "Beverages" (string or null)
- sale_price_ht: price if clearly visible on label/tag (number or null)
- brand: brand name if visible (string or null)
- confidence_note: a short sentence about what was and wasn't visible (string, required)

Rules:
- Return ONLY the raw JSON object, no markdown, no explanation, no code blocks
- If something is not visible or unclear, use null
- For barcode, extract only the numeric string, not the barcode type
- For price, extract only the number without currency symbol
- Be conservative: only extract what you're confident about

Return the JSON now:`;

    const result = await this.groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    let responseText = result.choices[0].message.content?.trim() ?? '';
    responseText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');

    const parsedResult = JSON.parse(responseText);

    return {
      name: parsedResult.name || null,
      description: parsedResult.description || null,
      barcode: parsedResult.barcode || null,
      unit: parsedResult.unit || null,
      suggested_category_name: parsedResult.suggested_category_name || null,
      sale_price_ht: parsedResult.sale_price_ht || null,
      brand: parsedResult.brand || null,
      confidence_note: parsedResult.confidence_note || 'Analysis completed',
    };
  }

  async scanServiceDescription(description: string): Promise<ScanServiceDescriptionResponseDto> {
    if (!this.groq) {
      throw new Error('Groq API key not configured. Please add GROQ_API_KEY to your .env file.');
    }

    const prompt = `You are helping a business owner create a service entry in their management platform. The user will describe their service in natural language, possibly informal or incomplete. Extract structured information and return ONLY a raw JSON object with these exact fields:
- name: a clean professional service name (string or null)
- description: a clear professional description of the service (string or null, max 200 chars)
- suggested_category_name: the most fitting service category name like "Consulting", "Maintenance", "Repair", "Training", "Delivery", "Installation", "Support", "Design", "Cleaning", "Transport" — pick the closest match or suggest a new one (string or null)
- price_ht: the price if mentioned, as a number without currency (number or null)
- duration_note: if the user mentioned duration like "2 hours" or "half day", capture it as a short string to add to description (string or null)
- confidence_note: one sentence about what was clear and what was assumed (string, required)

Rules:
- Return ONLY the raw JSON object, no markdown, no explanation, no code blocks
- Be conservative: only extract what you are confident about
- For name: make it professional and capitalize properly
- For suggested_category_name: always suggest something, even if you have to guess from context

User description: ${description}

Return the JSON now:`;

    const result = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    let responseText = result.choices[0].message.content?.trim() ?? '';
    responseText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');

    const parsedResult = JSON.parse(responseText);

    return {
      name: parsedResult.name || null,
      description: parsedResult.description || null,
      suggested_category_name: parsedResult.suggested_category_name || null,
      price_ht: parsedResult.price_ht || null,
      duration_note: parsedResult.duration_note || null,
      confidence_note: parsedResult.confidence_note || 'Analysis completed',
    };
  }

  async generateSku(businessId: string, dto: GenerateSkuDto): Promise<string> {
    if (dto.type === 'SERVICE') {
      let categoryCode = 'GEN';
      if (dto.category_name) {
        categoryCode = dto.category_name
          .substring(0, 4)
          .toUpperCase()
          .replace(/[^A-Z]/g, '');
        if (categoryCode.length === 0) categoryCode = 'GEN';
      }

      let nameCode = 'SERV';
      if (dto.name) {
        nameCode = dto.name
          .replace(/[^A-Za-z0-9]/g, '')
          .substring(0, 6)
          .toUpperCase();
        if (nameCode.length === 0) nameCode = 'SERV';
      }

      const existingCount = await this.productRepo.count({
        where: { business_id: businessId, sku: Like('SRV-%') },
      });

      const suffix = String(existingCount + 1).padStart(4, '0');
      return `SRV-${categoryCode}-${nameCode}-${suffix}`;
    }

    let categoryPrefix = 'GEN';
    if (dto.category_name) {
      categoryPrefix = dto.category_name
        .substring(0, 4)
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
      if (categoryPrefix.length === 0) categoryPrefix = 'GEN';
    }

    let brandOrNameToken = '000';
    const sourceText = dto.brand || dto.name;
    if (sourceText) {
      brandOrNameToken = sourceText
        .substring(0, 4)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      if (brandOrNameToken.length === 0) brandOrNameToken = '000';
    }

    let attributeToken = '';
    if (dto.extra_attribute) {
      attributeToken = dto.extra_attribute
        .replace(/[^A-Za-z0-9]/g, '')
        .substring(0, 6)
        .toUpperCase();
    }

    const existingCount = await this.productRepo.count({
      where: { business_id: businessId, sku: Like(`${categoryPrefix}-%`) },
    });

    const suffix = String(existingCount + 1).padStart(4, '0');
    let sku = `${categoryPrefix}-${brandOrNameToken}`;
    if (attributeToken) sku += `-${attributeToken}`;
    sku += `-${suffix}`;

    return sku;
  }

  async generateBarcode(businessId: string, productId: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id: productId, business_id: businessId },
      relations: ['warehouse'],
    });

    if (!product) throw new NotFoundException(`Product with ID ${productId} not found`);

    const warehouseCode = product.warehouse?.code || null;
    const barcode = generateInternalBarcode(warehouseCode, productId);
    product.barcode = barcode;
    return this.productRepo.save(product);
  }

  async generateLabel(businessId: string, productId: string, userId?: string): Promise<Buffer> {
    const product = await this.productRepo.findOne({
      where: { id: productId, business_id: businessId },
      relations: ['warehouse', 'category'],
    });

    if (!product) throw new NotFoundException(`Product with ID ${productId} not found`);

    const business = await this.businessRepo.findOne({ where: { id: businessId } });

    let barcodeValue = product.barcode;
    if (!barcodeValue) {
      const warehouseCode = product.warehouse?.code || null;
      barcodeValue = generateInternalBarcode(warehouseCode, productId);
    }

    // Update print tracking
    if (userId) {
      product.printed_by = userId;
      product.printed_at = new Date();
      await this.productRepo.save(product);

      // Log print action
      await this.auditLogService.log({
        business_id: businessId,
        action: AuditAction.PRINT,
        entity_type: AuditEntityType.PRODUCT,
        entity_id: product.id,
        entity_name: product.name,
        performed_by: userId,
        description: `Label printed for: ${product.name}`,
      });
    }

    return this.createLabelPDF(business?.name || 'Business', product, barcodeValue);
  }

  async generateBulkLabels(businessId: string, productIds: string[]): Promise<Buffer> {
    const products = await this.productRepo.find({
      where: { id: In(productIds), business_id: businessId },
      relations: ['warehouse', 'category'],
    });

    if (products.length === 0) throw new NotFoundException('No products found');

    const business = await this.businessRepo.findOne({ where: { id: businessId } });

    return this.createBulkLabelsPDF(business?.name || 'Business', products);
  }

  private async createLabelPDF(businessName: string, product: Product, barcodeValue: string): Promise<Buffer> {
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: barcodeValue,
      scale: 2,
      height: 10,
      includetext: false,
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [288, 216], margin: 10 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        doc.fontSize(8).text(businessName, { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(14).font('Helvetica-Bold').text(product.name, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`SKU: ${product.sku}`, { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).text(barcodeValue, { align: 'center' });
        doc.moveDown(0.3);

        const imgWidth = 200;
        const imgX = (doc.page.width - imgWidth) / 2;
        doc.image(barcodeBuffer, imgX, doc.y, { width: imgWidth });
        doc.moveDown(3);

        const info: string[] = [];
        if (product.warehouse) info.push(`Warehouse: ${product.warehouse.name}`);
        if (product.category) info.push(`Category: ${product.category.name}`);
        if (info.length > 0) doc.fontSize(8).text(info.join(' | '), { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async createBulkLabelsPDF(businessName: string, products: Product[]): Promise<Buffer> {
    const barcodeImages = await Promise.all(
      products.map(async (product) => {
        let barcodeValue = product.barcode;
        if (!barcodeValue) {
          const warehouseCode = product.warehouse?.code || null;
          barcodeValue = generateInternalBarcode(warehouseCode, product.id);
        }

        const buffer = await bwipjs.toBuffer({
          bcid: 'code128',
          text: barcodeValue,
          scale: 2,
          height: 8,
          includetext: false,
        });

        return { product, barcodeValue, buffer };
      }),
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 20 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        const labelWidth = 288;
        const labelHeight = 216;
        const cols = 2;
        const rows = 2;
        const marginX = 20;
        const marginY = 20;

        barcodeImages.forEach(({ product, barcodeValue, buffer }, currentLabel) => {
          const col = currentLabel % cols;
          const row = Math.floor((currentLabel % (cols * rows)) / cols);

          if (currentLabel > 0 && currentLabel % (cols * rows) === 0) doc.addPage();

          const x = marginX + col * labelWidth;
          const y = marginY + row * labelHeight;

          doc.save();
          doc.translate(x, y);

          doc.fontSize(8).text(businessName, 10, 10, { width: labelWidth - 20, align: 'center' });
          doc.fontSize(12).font('Helvetica-Bold').text(product.name, 10, 30, {
            width: labelWidth - 20,
            align: 'center',
            ellipsis: true,
          });
          doc.fontSize(9).font('Helvetica').text(`SKU: ${product.sku}`, 10, 55, {
            width: labelWidth - 20,
            align: 'center',
          });
          doc.fontSize(8).text(barcodeValue, 10, 70, { width: labelWidth - 20, align: 'center' });

          const imgWidth = 180;
          const imgX = (labelWidth - imgWidth) / 2;
          doc.image(buffer, imgX, 85, { width: imgWidth });

          const info: string[] = [];
          if (product.warehouse) info.push(`WH: ${product.warehouse.name}`);
          if (product.category) info.push(`Cat: ${product.category.name}`);
          if (info.length > 0) {
            doc.fontSize(7).text(info.join(' | '), 10, 150, {
              width: labelWidth - 20,
              align: 'center',
            });
          }

          doc.restore();
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}