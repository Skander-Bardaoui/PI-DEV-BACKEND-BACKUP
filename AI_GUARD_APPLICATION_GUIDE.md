# AI Feature Guard Application Guide

## ✅ Already Applied
- ✅ Subtasks Module: `POST /subtasks/generate`

## 🔄 Remaining AI Endpoints to Protect

### 1. Purchases Module

#### File: `src/Purchases/controllers/supplier-pos.controller.ts`
```typescript
// Add import at top:
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

// Apply guard to endpoint (line ~36):
@Post('generate-from-text')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
@Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
@HttpCode(HttpStatus.OK)
async generateFromText(...)
```

#### File: `src/Purchases/controllers/suppliers.controller.ts`
```typescript
// Add import at top:
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

// Apply guard to endpoint (line ~103):
@Get('recommendations/ai')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
@Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
async getRecommendations(...)
```

#### File: `src/Purchases/controllers/ocr.controller.ts`
```typescript
// Add import at top:
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

// Apply guard to endpoint (line ~28):
@Post('extract')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
@Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
async extractFromFile(...)
```

#### File: `src/Purchases/controllers/three-way-matching.controller.ts`
```typescript
// Add import at top:
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

// Apply guard to ALL matching endpoints:
@Post('invoice/:invoiceId/match')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
async matchInvoice(...)

@Post('invoice/:invoiceId/auto-match')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
async autoMatchInvoice(...)

@Post('match-all')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
async matchAllPending(...)

@Post('invoice/:invoiceId/contact-supplier')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
async contactSupplier(...)
```

#### File: `src/Purchases/purchases.module.ts`
```typescript
// Add imports:
import { Subscription } from '../platform-admin/entities/subscription.entity';
import { AiFeatureGuard } from '../platform-admin/guards/ai-feature.guard';

// In @Module imports array, add Subscription to TypeOrmModule.forFeature:
TypeOrmModule.forFeature([
  // ... existing entities ...
  Subscription,  // ADD THIS
]),

// In providers array, add:
providers: [
  // ... existing providers ...
  AiFeatureGuard,  // ADD THIS
],
```

### 2. Sales Module

#### File: `src/sales/controllers/sales-dashboard.controller.ts`
```typescript
// Add import at top:
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

// Apply guard to endpoints:
@Get('ai-forecast')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
@Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
async getAiForecast(...)

@Post('generate-email-draft')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
@Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
async generateEmailDraft(...)
```

#### File: `src/sales/controllers/sales-ml.controller.ts`
```typescript
// Add import at top:
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

// Apply guard to endpoint:
@Get('forecast')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
async getSalesForecast(...)
```

#### File: `src/sales/controllers/invoices.controller.ts`
```typescript
// Add import at top:
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

// Apply guard to endpoint:
@Post(':id/generate-email-draft')
@UseGuards(AiFeatureGuard)  // ADD THIS LINE
@Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
async generateEmailDraft(...)
```

#### File: `src/sales/sales.module.ts`
```typescript
// Add imports:
import { Subscription } from '../platform-admin/entities/subscription.entity';
import { AiFeatureGuard } from '../platform-admin/guards/ai-feature.guard';

// In @Module imports array, add Subscription to TypeOrmModule.forFeature:
TypeOrmModule.forFeature([
  // ... existing entities ...
  Subscription,  // ADD THIS
]),

// In providers array, add:
providers: [
  // ... existing providers ...
  AiFeatureGuard,  // ADD THIS
],
```

## Testing Checklist

After applying all guards:

1. ✅ Test with Premium plan (ai_enabled = true) - should work
2. ✅ Test with Standard plan (ai_enabled = false) - should return 403
3. ✅ Test with Free plan (ai_enabled = false) - should return 403
4. ✅ Verify error response format:
```json
{
  "error": "AI_NOT_AVAILABLE",
  "message": "Les fonctionnalités IA ne sont pas disponibles dans votre plan actuel. Passez au plan Premium pour y accéder.",
  "upgradeRequired": true
}
```

## Database Migration

Run this SQL to add the new columns if not using TypeORM sync:

```sql
-- Add ai_enabled column to plans table
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add trial_days column to plans table
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS trial_days INTEGER NULL;

-- Add expired status to subscription status enum
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'expired';

-- Update existing plans (if they exist)
UPDATE plans SET ai_enabled = false, trial_days = 7 WHERE slug = 'free';
UPDATE plans SET ai_enabled = false, trial_days = NULL WHERE slug = 'standard';
UPDATE plans SET ai_enabled = true, trial_days = NULL WHERE slug = 'premium';
```
