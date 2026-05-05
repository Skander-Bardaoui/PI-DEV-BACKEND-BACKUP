export enum StockMovementType {
  ENTREE_ACHAT = 'ENTREE_ACHAT',
  SORTIE_VENTE = 'SORTIE_VENTE',
  AJUSTEMENT_POSITIF = 'AJUSTEMENT_POSITIF',
  AJUSTEMENT_NEGATIF = 'AJUSTEMENT_NEGATIF',
  // Legacy values for backward compatibility
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}
