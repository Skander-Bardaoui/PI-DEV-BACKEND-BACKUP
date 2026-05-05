-- Migration: Tracking des actions sur les recommandations ML
-- Date: 2026-04-19
-- Description: Permet de suivre quelles recommandations ML ont été traitées

-- Table de tracking des actions sur les recommandations ML
CREATE TABLE IF NOT EXISTS ml_recommendation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  recommendation_date DATE NOT NULL,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('BC_CREATED', 'DISMISSED', 'IGNORED')),
  supplier_po_id UUID REFERENCES supplier_pos(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_ml_actions_business_product ON ml_recommendation_actions(business_id, product_id);
CREATE INDEX idx_ml_actions_date ON ml_recommendation_actions(recommendation_date);
CREATE INDEX idx_ml_actions_type ON ml_recommendation_actions(action_type);

-- Commentaires
COMMENT ON TABLE ml_recommendation_actions IS 'Tracking des actions prises sur les recommandations ML';
COMMENT ON COLUMN ml_recommendation_actions.action_type IS 'Type d''action: BC_CREATED (BC créé), DISMISSED (ignorée temporairement), IGNORED (ignorée définitivement)';
COMMENT ON COLUMN ml_recommendation_actions.recommendation_date IS 'Date de la recommandation ML originale';
COMMENT ON COLUMN ml_recommendation_actions.supplier_po_id IS 'Référence au BC créé (si action_type = BC_CREATED)';

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_ml_recommendation_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ml_recommendation_actions_updated_at
  BEFORE UPDATE ON ml_recommendation_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_ml_recommendation_actions_updated_at();
