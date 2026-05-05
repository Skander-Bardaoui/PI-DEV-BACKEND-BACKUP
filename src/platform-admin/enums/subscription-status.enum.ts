// src/platform-admin/enums/subscription-status.enum.ts
export enum SubscriptionStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAYMENT_SUBMITTED = 'payment_submitted',
  TRIAL = 'trial',
  ACTIVE = 'active',
  OVERDUE = 'overdue',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}
