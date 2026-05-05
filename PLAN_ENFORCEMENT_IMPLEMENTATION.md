# Plan Enforcement Implementation Status

## ✅ COMPLETED - Backend

### PART 1: Plan Seeding
- ✅ Added `ai_enabled` column to Plan entity (boolean, default false)
- ✅ Added `trial_days` column to Plan entity (int, nullable)
- ✅ Created `PlanSeedService` with OnModuleInit to seed 3 default plans
- ✅ Upsert logic based on slug (safe to run multiple times)
- ✅ Registered service in PlatformAuthModule

### PART 2: Free Plan Logic & Expiry
- ✅ Added `EXPIRED` status to SubscriptionStatus enum
- ✅ Created `SubscriptionExpiryService` with daily cron job (6am)
- ✅ Job finds free plan subscriptions past currentPeriodEnd and marks as expired
- ✅ Registered service in PlatformAuthModule
- ⚠️ Email sending commented out (needs EmailService integration)

### PART 3: AI Feature Guard
- ✅ Created `AiFeatureGuard` that checks subscription plan's ai_enabled field
- ✅ Returns proper 403 error with upgrade message
- ⚠️ **NEEDS TO BE APPLIED** to AI endpoints (see list below)

### PART 4: Plan Edit Restrictions
- ✅ Modified `PlanManagementService.updatePlan()` to only allow editing:
  - name, price_monthly, price_annual, is_active
- ✅ Silently ignores attempts to update: features, ai_enabled, trial_days, slug, max_users, max_businesses
- ✅ Added explanatory comment in code

### PART 5: Seed Endpoint
- ✅ Added POST /platform/plans/seed endpoint to PlanManagementController
- ✅ Calls PlanSeedService.seedDefaultPlans()

## 🔄 TODO - Backend

### Apply AiFeatureGuard to AI Endpoints

**Identified AI Endpoints:**

1. **Subtasks Module** (`src/subtasks/subtasks.controller.ts`):
   - `POST /businesses/:businessId/subtasks/generate` - Line 98

2. **Purchases Module** (`src/Purchases/controllers/`):
   - `POST /businesses/:businessId/supplier-pos/generate-from-text` - supplier-pos.controller.ts:36
   - `GET /businesses/:businessId/suppliers/recommendations/ai` - suppliers.controller.ts:103
   - `POST /businesses/:businessId/ocr/extract` - ocr.controller.ts:28 (uses AI enrichment)
   - `POST /businesses/:businessId/three-way-matching/invoice/:invoiceId/match` - three-way-matching.controller.ts:25 (when useAI=true)
   - `POST /businesses/:businessId/three-way-matching/invoice/:invoiceId/auto-match` - three-way-matching.controller.ts:37
   - `POST /businesses/:businessId/three-way-matching/match-all` - three-way-matching.controller.ts:49
   - `POST /businesses/:businessId/three-way-matching/invoice/:invoiceId/contact-supplier` - three-way-matching.controller.ts:59

3. **Sales Module** (`src/sales/controllers/`):
   - `GET /businesses/:businessId/sales/dashboard/ai-forecast` - sales-dashboard.controller.ts:33
   - `POST /businesses/:businessId/sales/dashboard/generate-email-draft` - sales-dashboard.controller.ts:39
   - `GET /businesses/:businessId/sales/ml/forecast` - sales-ml.controller.ts:11
   - `POST /businesses/:businessId/sales/invoices/:id/generate-email-draft` - invoices.controller.ts:91

**Implementation Steps:**
1. Export AiFeatureGuard from PlatformAuthModule
2. Import AiFeatureGuard in SubtasksModule, PurchasesModule, SalesModule
3. Add `@UseGuards(AiFeatureGuard)` decorator to each endpoint listed above

### Subscription Payment Logic for Free Plan
- Modify `SubscriptionPaymentService` to handle free plan activation
- Skip Stripe for amount === 0
- Set currentPeriodEnd = now + 7 days
- Set trialEndsAt = now + 7 days

### Auth Guard for Expired Subscriptions
- Add check in JWT auth guard or create middleware
- Block login when subscription status === 'expired'
- Return message: "Your free trial has expired. Please upgrade your plan."

## 🔄 TODO - Frontend

### PART 5: Registration - Plan Selection
- Update plan cards in registration flow
- Hardcode features based on plan.slug
- Free: "Gratuit" badge, "7 jours d'essai", no price display
- Standard: Blue badge, show prices
- Premium: Purple badge, "Recommandé", show prices, AI included

### PART 6: /pay/:token - Free Plan Bypass
- Detect amount === 0
- Show "Activer mon essai gratuit" button instead of Stripe form
- Call POST /api/subscriptions/pay/:token/confirm with freeActivation: true

### PART 7: Platform Admin Console - Plans Page
- Only show editable fields in Edit modal
- Add note: "Les fonctionnalités du plan sont fixes et ne peuvent pas être modifiées."
- Display features based on slug (not features array)
- Add lock icon on Features row
- Add "Seed default plans" button if no plans exist

### PART 8: Landing Page Plans Section
- Update plan cards to use slug-based feature display
- Maintain existing layout and scroll behavior

### PART 9: Emails
- Create trial expiry email template
- Subject: "NovEntra — Votre essai gratuit a expiré"
- Integrate with SubscriptionExpiryService

## 📝 Notes

- All backend entity changes require database migration
- Test existing paid plan flow (Standard/Premium) after changes
- Ensure Stripe payment flow remains untouched for paid plans
- AiFeatureGuard needs Subscription entity in TypeORM imports for each module that uses it
