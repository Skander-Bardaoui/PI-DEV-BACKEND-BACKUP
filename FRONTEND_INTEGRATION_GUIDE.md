# Frontend Integration Guide

## Backend API Changes

### 1. GET /api/subscriptions/pay/:token
**Response now includes amount:**
```json
{
  "tenantName": "Company Name",
  "ownerName": "John Doe",
  "planName": "Free",
  "billingCycle": "monthly",
  "amount": 0,  // ← Check this!
  "currency": "TND",
  "subscriptionId": "uuid",
  "status": "pending_payment"
}
```

**Frontend Logic:**
```typescript
const paymentData = await fetch(`/api/subscriptions/pay/${token}`);

if (paymentData.amount === 0) {
  // FREE PLAN - Show activation button
  showFreeActivationButton();
} else {
  // PAID PLAN - Show Stripe form
  showStripePaymentForm();
}
```

### 2. POST /api/subscriptions/pay/:token/confirm
**New optional parameters:**
```typescript
// For FREE plans:
POST /api/subscriptions/pay/:token/confirm
{
  "freeActivation": true
}

// For PAID plans (existing):
POST /api/subscriptions/pay/:token/confirm
{
  "paymentIntentId": "pi_xxx"
}
```

### 3. GET /api/plans/public
**Response includes new fields:**
```json
[
  {
    "id": "uuid",
    "name": "Free",
    "slug": "free",  // ← Use this for feature display
    "price_monthly": 0,
    "price_annual": 0,
    "features": ["full_access", "duration_7_days"],
    "ai_enabled": false,  // ← New field
    "trial_days": 7,      // ← New field
    "is_active": true
  }
]
```

## Frontend Implementation Tasks

### Task 1: Registration - Plan Selection
**File:** `PI-DEV-FRONT/src/pages/registration/PlanSelection.tsx` (or similar)

**Logic:**
```typescript
const getPlanFeatures = (slug: string) => {
  switch (slug) {
    case 'free':
      return {
        badge: { text: 'Gratuit', color: 'green' },
        price: 'Gratuit',
        subtitle: '7 jours d\'essai gratuit — accès complet',
        features: [
          { icon: '✅', text: 'Accès complet à la plateforme' },
          { icon: '✅', text: 'Toutes les fonctionnalités' },
          { icon: '⏱', text: 'Durée: 7 jours' },
          { icon: '❌', text: 'IA non incluse' },
        ]
      };
    
    case 'standard':
      return {
        badge: { text: 'Standard', color: 'blue' },
        price: `${plan.price_monthly} TND/mois`,
        features: [
          { icon: '✅', text: 'Accès complet à la plateforme' },
          { icon: '✅', text: 'Toutes les fonctionnalités' },
          { icon: '❌', text: 'IA non incluse' },
        ]
      };
    
    case 'premium':
      return {
        badge: { text: 'Premium', color: 'purple' },
        recommended: true,
        price: `${plan.price_monthly} TND/mois`,
        features: [
          { icon: '✅', text: 'Accès complet à la plateforme' },
          { icon: '✅', text: 'Toutes les fonctionnalités' },
          { icon: '✅', text: 'IA illimitée incluse' },
        ]
      };
    
    default:
      return { features: plan.features }; // Fallback
  }
};
```

### Task 2: Payment Page - Free Plan Bypass
**File:** `PI-DEV-FRONT/src/pages/payment/PaymentPage.tsx` (or similar)

**Logic:**
```typescript
const PaymentPage = () => {
  const { token } = useParams();
  const [paymentData, setPaymentData] = useState(null);
  
  useEffect(() => {
    fetchPaymentData();
  }, [token]);
  
  const fetchPaymentData = async () => {
    const data = await fetch(`/api/subscriptions/pay/${token}`);
    setPaymentData(data);
  };
  
  const handleFreeActivation = async () => {
    try {
      await fetch(`/api/subscriptions/pay/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeActivation: true })
      });
      
      // Redirect to success page
      navigate(`/pay/${token}/success`);
    } catch (error) {
      console.error('Activation failed:', error);
    }
  };
  
  if (!paymentData) return <Loading />;
  
  // FREE PLAN
  if (paymentData.amount === 0) {
    return (
      <div className="payment-container">
        <h1>Activez votre essai gratuit</h1>
        <div className="plan-summary">
          <p>Plan: {paymentData.planName}</p>
          <p>Durée: 7 jours</p>
          <p>Prix: Gratuit</p>
        </div>
        <button onClick={handleFreeActivation}>
          Activer mon essai gratuit
        </button>
      </div>
    );
  }
  
  // PAID PLAN (existing Stripe logic)
  return (
    <div className="payment-container">
      <StripePaymentForm token={token} amount={paymentData.amount} />
    </div>
  );
};
```

### Task 3: Platform Admin - Plans Page
**File:** `PI-DEV-FRONT/src/pages/admin/PlansPage.tsx` (or similar)

**Edit Modal - Only show editable fields:**
```typescript
const PlanEditModal = ({ plan, onSave }) => {
  const [formData, setFormData] = useState({
    name: plan.name,
    price_monthly: plan.price_monthly,
    price_annual: plan.price_annual,
    is_active: plan.is_active,
  });
  
  return (
    <Modal>
      <h2>Modifier le plan</h2>
      
      <Input 
        label="Nom" 
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
      />
      
      <Input 
        label="Prix mensuel (TND)" 
        type="number"
        value={formData.price_monthly}
        onChange={(e) => setFormData({...formData, price_monthly: e.target.value})}
      />
      
      <Input 
        label="Prix annuel (TND)" 
        type="number"
        value={formData.price_annual}
        onChange={(e) => setFormData({...formData, price_annual: e.target.value})}
      />
      
      <Toggle 
        label="Actif" 
        checked={formData.is_active}
        onChange={(checked) => setFormData({...formData, is_active: checked})}
      />
      
      <div className="info-box">
        <LockIcon />
        <p>Les fonctionnalités du plan sont fixes et ne peuvent pas être modifiées.</p>
      </div>
      
      <Button onClick={() => onSave(formData)}>Enregistrer</Button>
    </Modal>
  );
};
```

**Display features based on slug:**
```typescript
const PlanCard = ({ plan }) => {
  const getFeatureChips = (slug) => {
    switch (slug) {
      case 'free':
        return [
          { text: 'Essai 7 jours', color: 'green' },
          { text: 'Accès complet', color: 'blue' },
          { text: 'Sans IA', color: 'gray' },
        ];
      case 'standard':
        return [
          { text: 'Standard', color: 'blue' },
          { text: 'Accès complet', color: 'blue' },
          { text: 'Sans IA', color: 'gray' },
        ];
      case 'premium':
        return [
          { text: 'Premium', color: 'purple' },
          { text: 'Accès complet', color: 'blue' },
          { text: 'IA illimitée', color: 'purple' },
        ];
      default:
        return [];
    }
  };
  
  return (
    <div className="plan-card">
      <h3>{plan.name}</h3>
      <div className="features">
        <LockIcon /> {/* Visual indicator */}
        {getFeatureChips(plan.slug).map(chip => (
          <Chip key={chip.text} color={chip.color}>{chip.text}</Chip>
        ))}
      </div>
      <Button onClick={() => openEditModal(plan)}>Modifier</Button>
    </div>
  );
};
```

**Seed button (if no plans):**
```typescript
const PlansPage = () => {
  const [plans, setPlans] = useState([]);
  
  const handleSeedPlans = async () => {
    await fetch('/api/platform/plans/seed', { method: 'POST' });
    fetchPlans(); // Reload
  };
  
  if (plans.length === 0) {
    return (
      <div className="empty-state">
        <p>Aucun plan trouvé</p>
        <Button onClick={handleSeedPlans}>
          Créer les plans par défaut
        </Button>
      </div>
    );
  }
  
  return <div>{/* Plan cards */}</div>;
};
```

### Task 4: Landing Page - Plans Section
**File:** `PI-DEV-FRONT/src/pages/landing/PricingSection.tsx` (or similar)

Use the same `getPlanFeatures(slug)` logic from Task 1.
Just update the feature display, keep existing layout/scroll.

### Task 5: Error Handling - AI Access Denied
**Global error handler or API interceptor:**
```typescript
// In your API client (axios/fetch wrapper)
const handleApiError = (error) => {
  if (error.response?.data?.error === 'AI_NOT_AVAILABLE') {
    // Show upgrade modal
    showUpgradeModal({
      title: 'Fonctionnalité Premium',
      message: error.response.data.message,
      action: 'Passer au plan Premium',
      onUpgrade: () => navigate('/upgrade'),
    });
    return;
  }
  
  // Handle other errors...
};
```

## Testing Checklist

### Free Plan Flow
- [ ] Register with Free plan
- [ ] Redirected to /pay/:token
- [ ] See "Activer mon essai gratuit" button (no Stripe form)
- [ ] Click button
- [ ] Redirected to success page
- [ ] Can login and use platform
- [ ] Cannot access AI features (403 error)
- [ ] After 7 days, cannot login (expired message)

### Paid Plan Flow
- [ ] Register with Standard/Premium
- [ ] Redirected to /pay/:token
- [ ] See Stripe payment form
- [ ] Complete payment
- [ ] Redirected to success page
- [ ] Can login and use platform
- [ ] Premium: Can access AI features
- [ ] Standard: Cannot access AI features (403)

### Admin Console
- [ ] View plans page
- [ ] See 3 plans with correct features
- [ ] Edit plan - only see name, prices, active
- [ ] Try to edit features - should be ignored
- [ ] See lock icon on features
- [ ] See note about fixed features

## API Endpoints Reference

```
Public (No Auth):
GET  /api/plans/public
GET  /api/subscriptions/pay/:token
POST /api/subscriptions/pay/:token/create-payment-intent
POST /api/subscriptions/pay/:token/confirm

Admin (Platform Admin):
GET    /api/platform/plans
POST   /api/platform/plans/seed
POST   /api/platform/plans
PATCH  /api/platform/plans/:id
DELETE /api/platform/plans/:id
```

## Common Issues & Solutions

### Issue: "Payment intent required"
**Cause:** Trying to activate paid plan without paymentIntentId
**Solution:** Only send `freeActivation: true` for free plans (amount === 0)

### Issue: AI endpoint returns 403
**Cause:** User's plan doesn't have ai_enabled = true
**Solution:** Show upgrade modal, don't retry the request

### Issue: Can't login after 7 days
**Cause:** Free trial expired
**Solution:** Show upgrade page, allow plan selection

### Issue: Features not displaying correctly
**Cause:** Using features array instead of slug
**Solution:** Always use slug-based logic for feature display

## Support

For backend questions or issues:
- Check `BACKEND_COMPLETE_FINAL.md` for implementation details
- Check `AI_GUARD_APPLICATION_GUIDE.md` for AI endpoint list
- All backend code is documented with comments

Good luck with the frontend implementation! 🚀
