export enum InvoiceStatus {
  PENDING        = 'PENDING',        // saisie, en attente d'approbation
  APPROVED       = 'APPROVED',       // approuvée, prête à être payée
  PARTIALLY_PAID = 'PARTIALLY_PAID', // paiement partiel enregistré
  PAID           = 'PAID',           // intégralement payée
  OVERDUE        = 'OVERDUE',        // échéance dépassée, non payée
  DISPUTED       = 'DISPUTED',       // litige en cours avec le fournisseur
}