// ══════════════════════════════════════════════════════════════════════════════
// FICHIER 1 — src/Purchases/purchases.module.ts
// ══════════════════════════════════════════════════════════════════════════════
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule }      from '@nestjs/typeorm';
import { HttpModule }         from '@nestjs/axios';
import { ScheduleModule }     from '@nestjs/schedule';
import { MulterModule }       from '@nestjs/platform-express';
import { JwtModule }          from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
 
// Entités — SupplierPayment RETIRÉ (géré par PaymentsModule)
import { GoodsReceipt }        from './entities/goods-receipt.entity';
import { GoodsReceiptItem }    from './entities/goods-receipt-item.entity';
import { PurchaseInvoice }     from './entities/purchase-invoice.entity';
import { SupplierPOItem }      from './entities/supplier-po-item.entity';
import { SupplierPO }          from './entities/supplier-po.entity';
import { Supplier }            from './entities/supplier.entity';
import { SupplierPortalToken } from './entities/supplier-portal-token.entity';
import { PurchaseAlert }       from './entities/purchase-alert.entity';
import { DisputeResponse }     from './entities/dispute-response.entity';
import { MLRecommendationAction } from './entities/ml-recommendation-action.entity';
import { Business }            from '../businesses/entities/business.entity';
import { StockMovement }       from '../stock/entities/stock-movement.entity';
import { Product }             from '../stock/entities/product.entity';
import { SupplierPayment }     from '../payments/entities/supplier-payment.entity';
// import { Product }             from '../products/entities/product.entity'; // Module pas encore implémenté
 
// Controllers — SupplierPaymentsController RETIRÉ (dans PaymentsModule)
import { PurchasesController }        from './purchases.controller';
import { SuppliersController }        from './controllers/suppliers.controller';
import { SupplierPOsController }      from './controllers/supplier-pos.controller';
import { GoodsReceiptsController }    from './controllers/goods-receipts.controller';
import { PurchaseInvoicesController } from './controllers/purchase-invoices.controller';
import { SupplierPortalController }   from './controllers/supplier-portal.controller';
import { UploadController }           from './controllers/upload.controller';
import { PurchaseAlertsController }   from './controllers/purchase-alerts.controller';
import { ThreeWayMatchingController } from './controllers/three-way-matching.controller';
import { OcrController }              from './controllers/ocr.controller';
 
// Services — SupplierPaymentsService RETIRÉ (dans PaymentsModule)
import { PurchasesService }        from './purchases.service';
import { SuppliersService }        from './services/suppliers.service';
import { SupplierPOsService }      from './services/supplier-pos.service';
import { GoodsReceiptsService }    from './services/goods-receipts.service';
import { PurchaseInvoicesService } from './services/purchase-invoices.service';
import { PurchaseMailService }     from './services/purchase-mail.service';
import { SupplierPortalService }   from './services/supplier-portal.service';
import { PurchaseAlertsService }   from './services/purchase-alerts.service';
import { ThreeWayMatchingService } from './services/three-way-matching.service';
import { ThreeWayMatchingAIService } from './services/three-way-matching-ai.service';
import { SupplierScoringService }  from './services/supplier-scoring.service';
import { PoAiGeneratorService }    from './services/po-ai-generator.service';
import { SupplierAiInsightsService } from './services/supplier-ai-insights.service';
 
// FIX : import du module payments avec forwardRef des DEUX côtés
import { PaymentsModule } from '../payments/payments.module';
import { StockModule } from '../stock/stock.module';
import { SupplierScoringController } from './controllers/supplier-scoring.controller';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { SupplierOnboardingController } from './controllers/supplier-onboarding.controller';
import { SupplierOnboardingService } from './services/supplier-onboarding.service';
import { SupplierRecommendationService } from './services/supplier-recommendation.service';
import { PurchaseAiAssistantService } from './services/purchase-ai-assistant.service';
import { SupplierOnboardingPublicController } from './controllers/supplier-onboarding.controller';
import { PurchaseAiAssistantController } from './controllers/purchase-ai-assistant.controller';
import { PurchaseOcrAiService } from './services/purchase-ocr-ai.service';
import { OcrService } from './services/ocr.service';
import { DisputeResolutionService } from './services/dispute-resolution.service';
import { DisputeResolutionController } from './controllers/dispute-resolution.controller';
import { MlPredictionService } from './services/ml-prediction.service';
import { MlPredictionController } from './controllers/ml-prediction.controller';
import { PurchasePermissionGuard } from './guards/purchase-permission.guard';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Subscription } from '../platform-admin/entities/subscription.entity';
import { AiFeatureGuard } from '../platform-admin/guards/ai-feature.guard';
 
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoodsReceipt, GoodsReceiptItem, PurchaseInvoice,
      SupplierPOItem, SupplierPO, Supplier,
      PurchaseAlert, DisputeResponse, MLRecommendationAction, Business, Tenant, User,
      StockMovement, Product, SupplierPayment, BusinessMember, Subscription,
      // Product, // Module pas encore implémenté
      // SupplierPortalToken temporairement retiré pour éviter les erreurs de synchronisation
    ]),
    forwardRef(() => PaymentsModule), // ← FIX : forwardRef des deux côtés
    StockModule, // Import StockModule to get StockMovementsService
    HttpModule,
    ScheduleModule.forRoot(),
    MulterModule.register({ dest: './uploads' }),
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_PORTAL_SECRET', 'portal_secret_key_change_me'),
        signOptions: { expiresIn: '72h' },
      }),
      inject: [ConfigService],
    }),
  ],
 
  controllers: [
    PurchasesController,
    SuppliersController,
    SupplierPOsController,
    GoodsReceiptsController,
    PurchaseInvoicesController,
    UploadController,
    SupplierPortalController,
    PurchaseAlertsController,
    ThreeWayMatchingController,
    SupplierScoringController,
    OcrController,
    SupplierOnboardingController,
    SupplierOnboardingPublicController,
    DisputeResolutionController,
    PurchaseAiAssistantController,
    MlPredictionController,
  ],
 
  providers: [
    PurchasesService,
    SuppliersService,
    SupplierPOsService,
    GoodsReceiptsService,
    PurchaseInvoicesService,
    PurchaseMailService,
    SupplierPortalService,
    PurchaseAlertsService,
    ThreeWayMatchingService,
    ThreeWayMatchingAIService,
    SupplierScoringService,
    OcrService,
    PurchaseOcrAiService,
    PoAiGeneratorService,
    SupplierAiInsightsService,
    SupplierOnboardingService,
    DisputeResolutionService,
    SupplierRecommendationService,
    PurchaseAiAssistantService,
    MlPredictionService,
    PurchasePermissionGuard,
    AiFeatureGuard,
  ],
 
  exports: [
    PurchasesService,
    PurchaseInvoicesService,
    SuppliersService,        // ← exporter SuppliersService pour PaymentsModule
    TypeOrmModule,           // ← exporter les repositories pour PaymentsModule
  ],
})
export class PurchasesModule {}
 