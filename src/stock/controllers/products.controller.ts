// src/stock/controllers/products.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  Res,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ScanProductImageResponseDto } from '../dto/scan-product-image.dto';
import { ScanServiceDescriptionResponseDto } from '../dto/scan-service-description.dto';
import { GenerateSkuDto, GenerateSkuResponseDto } from '../dto/generate-sku.dto';
import { BulkLabelsDto } from '../dto/bulk-labels.dto';
import { QueryProductsDto } from '../dto/query-products.dto';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import type { Response } from 'express';

@Controller('businesses/:businessId/products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    @InjectRepository(BusinessMember)
    private readonly businessMemberRepository: Repository<BusinessMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  private transformFrontendDto(frontendDto: any): any {
    const backendDto: any = { ...frontendDto };

    if (frontendDto.reference !== undefined) {
      backendDto.sku = frontendDto.reference;
      delete backendDto.reference;
    }
    if (frontendDto.sale_price_ht !== undefined) {
      backendDto.price = frontendDto.sale_price_ht;
      delete backendDto.sale_price_ht;
    }
    if (frontendDto.purchase_price_ht !== undefined) {
      backendDto.cost = frontendDto.purchase_price_ht;
      delete backendDto.purchase_price_ht;
    }
    if (frontendDto.current_stock !== undefined) {
      backendDto.quantity = frontendDto.current_stock;
      delete backendDto.current_stock;
    }
    if (frontendDto.min_stock_threshold !== undefined) {
      backendDto.min_quantity = frontendDto.min_stock_threshold;
      delete backendDto.min_stock_threshold;
    }
    if (frontendDto.is_stockable !== undefined) {
      backendDto.track_inventory = frontendDto.is_stockable;
      delete backendDto.is_stockable;
    }

    // Convert empty strings to null for UUID fields to avoid PostgreSQL validation errors
    if (backendDto.warehouse_id === '') {
      backendDto.warehouse_id = null;
    }
    if (backendDto.category_id === '') {
      backendDto.category_id = null;
    }
    if (backendDto.default_supplier_id === '') {
      backendDto.default_supplier_id = null;
    }
    if (backendDto.barcode === '') {
      backendDto.barcode = null;
    }

    return backendDto;
  }

  private transformToFrontend(product: any): any {
    return {
      ...product,
      reference: product.sku,
      sale_price_ht: parseFloat(product.price) || 0,
      purchase_price_ht: parseFloat(product.cost) || 0,
      current_stock: parseFloat(product.quantity) || 0,
      min_stock_threshold: parseFloat(product.min_quantity) || 0,
      is_stockable: product.track_inventory,
    };
  }

  /**
   * Check if user has permission for product operation
   * Checks create_service/update_service/delete_service for SERVICE type
   * Checks create_product/update_product/delete_product for other types
   */
  private async checkProductPermission(
    businessId: string,
    userId: string,
    userRole: string,
    productType: string,
    operation: 'create' | 'update' | 'delete',
  ): Promise<void> {
    // Get user to check role
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // PLATFORM_ADMIN always has full access
    if (user.role === Role.PLATFORM_ADMIN) {
      return;
    }

    // BUSINESS_OWNER: Check if they own the tenant that owns this business
    if (user.role === Role.BUSINESS_OWNER) {
      const tenant = await this.tenantRepository.findOne({
        where: { ownerId: userId },
      });

      if (tenant) {
        const business = await this.businessRepository.findOne({
          where: { id: businessId },
        });

        // If the business belongs to the tenant owned by this user, they have full access
        if (business && business.tenant_id === tenant.id) {
          return;
        }
      }
    }

    // Get member permissions for other roles
    const member = await this.businessMemberRepository.findOne({
      where: { business_id: businessId, user_id: userId, is_active: true },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this business');
    }

    // BUSINESS_OWNER role in business_members also has full access
    if (member.role === Role.BUSINESS_OWNER) {
      return;
    }

    // Determine permission key based on product type
    const isService = productType === 'SERVICE';
    const permissionKey = isService
      ? `${operation}_service`
      : `${operation}_product`;

    // Check permission (default to false if missing)
    const hasPermission = member.stock_permissions?.[permissionKey] === true;

    if (!hasPermission) {
      throw new ForbiddenException(`Insufficient permissions to ${operation} ${isService ? 'services' : 'products'}`);
    }
  }

  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: QueryProductsDto,
  ) {
    const products = await this.productsService.findAll(businessId, query);
    return products.map(p => this.transformToFrontend(p));
  }

  @Get('alerts')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async findAlerts(@Param('businessId', ParseUUIDPipe) businessId: string) {
    const products = await this.productsService.findAlerts(businessId);
    return products.map(p => this.transformToFrontend(p));
  }

  @Post('scan-image')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Only JPEG, PNG, and WEBP images are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async scanImage(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ScanProductImageResponseDto> {
    if (!file) throw new BadRequestException('No image file provided');

    try {
      return await this.productsService.scanProductImage(file.buffer, file.mimetype);
    } catch (error: any) {
      console.error('Error scanning product image:', error);
      if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
        throw new BadGatewayException('Image scanning service has exceeded quota. Please try again later.');
      }
      if (error?.message?.includes('API key') || error?.status === 401 || error?.status === 403) {
        throw new BadGatewayException('Image scanning service is not configured. Please contact your administrator.');
      }
      throw new BadGatewayException('Failed to analyze image. Please try again.');
    }
  }

  @Post('generate-sku')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async generateSku(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: GenerateSkuDto,
  ): Promise<GenerateSkuResponseDto> {
    const sku = await this.productsService.generateSku(businessId, dto);
    return { sku };
  }

  @Post('scan-service-description')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async scanServiceDescription(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: { description: string },
  ): Promise<ScanServiceDescriptionResponseDto> {
    const { description } = body;

    if (!description || typeof description !== 'string') {
      throw new BadRequestException('Description is required and must be a string');
    }
    if (description.length < 10) {
      throw new BadRequestException('Description must be at least 10 characters');
    }
    if (description.length > 1000) {
      throw new BadRequestException('Description must not exceed 1000 characters');
    }

    try {
      return await this.productsService.scanServiceDescription(description);
    } catch (error: any) {
      console.error('Error scanning service description:', error);
      if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
        throw new BadGatewayException('AI service has exceeded quota. Please try again later.');
      }
      if (error?.message?.includes('API key') || error?.status === 401 || error?.status === 403) {
        throw new BadGatewayException('AI service is not configured. Please contact your administrator.');
      }
      throw new BadGatewayException('Failed to analyze description. Please try again.');
    }
  }

  // Archive routes must come BEFORE :id route to avoid UUID parsing issues
  @Get('archived')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async getArchived(
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    const products = await this.productsService.findArchived(businessId);
    return products.map(p => this.transformToFrontend(p));
  }

  @Get(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const product = await this.productsService.findOne(businessId, id);
    return this.transformToFrontend(product);
  }

  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: any,
    @Request() req,
  ) {
    // Check permission based on product type
    await this.checkProductPermission(
      businessId,
      req.user.id,
      req.user.role,
      dto.type || 'PHYSICAL',
      'create',
    );

    const backendDto = this.transformFrontendDto(dto);
    const product = await this.productsService.create(businessId, backendDto, req.user?.id);
    return this.transformToFrontend(product);
  }

  @Put(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @Request() req,
  ) {
    // Fetch existing product to check its type
    const existingProduct = await this.productsService.findOne(businessId, id);
    
    // Check permission based on existing product type
    await this.checkProductPermission(
      businessId,
      req.user.id,
      req.user.role,
      existingProduct.type,
      'update',
    );

    const backendDto = this.transformFrontendDto(dto);
    const product = await this.productsService.update(businessId, id, backendDto, req.user?.id);
    return this.transformToFrontend(product);
  }

  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async softDelete(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    // Fetch existing product to check its type
    const existingProduct = await this.productsService.findOne(businessId, id);
    
    // Check permission based on existing product type
    await this.checkProductPermission(
      businessId,
      req.user.id,
      req.user.role,
      existingProduct.type,
      'delete',
    );

    const product = await this.productsService.softDelete(businessId, id, req.user.id);
    return this.transformToFrontend(product);
  }

  @Post(':id/restore')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async restore(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    const product = await this.productsService.restore(businessId, id, req.user.id);
    return this.transformToFrontend(product);
  }

  // ==================== Product image endpoints ====================
  @Post(':id/image')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|webp|gif)$/)) {
        return cb(new BadRequestException('Only JPEG, PNG, WEBP, and GIF images are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async uploadImage(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No image file provided');
    const product = await this.productsService.uploadImage(businessId, id, file.buffer, file.mimetype);
    return this.transformToFrontend(product);
  }

  @Delete(':id/image')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async removeImage(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const product = await this.productsService.removeImage(businessId, id);
    return this.transformToFrontend(product);
  }
  // ================================================================

  @Post(':id/generate-barcode')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async generateBarcode(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const product = await this.productsService.generateBarcode(businessId, id);
    return this.transformToFrontend(product);
  }

  @Get(':id/label')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async getLabel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const product = await this.productsService.findOne(businessId, id);
    const pdfBuffer = await this.productsService.generateLabel(businessId, id, req.user?.id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="label-${product.sku}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  @Post('labels/bulk')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async getBulkLabels(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: BulkLabelsDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.productsService.generateBulkLabels(businessId, dto.product_ids);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="labels-bulk.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }
}