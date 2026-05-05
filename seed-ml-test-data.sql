-- ═══════════════════════════════════════════════════════════════════════════
-- Script de données de test pour Machine Learning
-- ═══════════════════════════════════════════════════════════════════════════
-- Ce script crée des données de test pour tester les prédictions ML
-- Minimum 3 achats par produit requis pour avoir des recommandations
-- ═══════════════════════════════════════════════════════════════════════════

-- IMPORTANT: Remplacez ces UUIDs par vos propres IDs de la base de données
-- Vous devez avoir:
-- 1. Un business_id (votre business actuel)
-- 2. Des product_id (vos produits existants)
-- 3. Des supplier_id (vos fournisseurs existants)

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAPE 1: Récupérer vos IDs existants
-- ═══════════════════════════════════════════════════════════════════════════

-- Exécutez ces requêtes pour obtenir vos IDs:

-- 1. Votre business ID:
-- SELECT id, name FROM businesses LIMIT 5;

-- 2. Vos produits:
-- SELECT id, name, category FROM products LIMIT 10;

-- 3. Vos fournisseurs:
-- SELECT id, name FROM suppliers LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAPE 2: Remplacez les variables ci-dessous avec vos IDs
-- ═══════════════════════════════════════════════════════════════════════════

-- REMPLACEZ CES VALEURS:
DO $$
DECLARE
    v_business_id UUID := 'VOTRE_BUSINESS_ID_ICI'; -- Exemple: '123e4567-e89b-12d3-a456-426614174000'
    v_supplier_id UUID := 'VOTRE_SUPPLIER_ID_ICI'; -- Exemple: '223e4567-e89b-12d3-a456-426614174000'
    
    -- Produits (vous devez avoir au moins 3 produits)
    v_product1_id UUID := 'VOTRE_PRODUIT_1_ID_ICI';
    v_product2_id UUID := 'VOTRE_PRODUIT_2_ID_ICI';
    v_product3_id UUID := 'VOTRE_PRODUIT_3_ID_ICI';
    
    -- Variables pour les bons de commande
    v_po1_id UUID;
    v_po2_id UUID;
    v_po3_id UUID;
    v_po4_id UUID;
    v_po5_id UUID;
    v_po6_id UUID;
    
BEGIN
    -- ═══════════════════════════════════════════════════════════════════════════
    -- PRODUIT 1: Historique de 5 achats (tendance croissante)
    -- ═══════════════════════════════════════════════════════════════════════════
    
    -- Achat 1 (il y a 150 jours) - 10 unités
    v_po1_id := gen_random_uuid();
    INSERT INTO supplier_pos (
        id, business_id, supplier_id, po_number, status, 
        total_ht, total_tax, total_ttc, created_at, updated_at
    ) VALUES (
        v_po1_id, v_business_id, v_supplier_id, 
        'PO-ML-001', 'completed',
        500.00, 95.00, 595.00,
        NOW() - INTERVAL '150 days',
        NOW() - INTERVAL '150 days'
    );
    
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po1_id, v_product1_id, 'Produit Test 1',
        10, 10, 50.00, 19.00, 500.00, 95.00, 1
    );
    
    -- Achat 2 (il y a 120 jours) - 15 unités
    v_po2_id := gen_random_uuid();
    INSERT INTO supplier_pos (
        id, business_id, supplier_id, po_number, status,
        total_ht, total_tax, total_ttc, created_at, updated_at
    ) VALUES (
        v_po2_id, v_business_id, v_supplier_id,
        'PO-ML-002', 'completed',
        750.00, 142.50, 892.50,
        NOW() - INTERVAL '120 days',
        NOW() - INTERVAL '120 days'
    );
    
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po2_id, v_product1_id, 'Produit Test 1',
        15, 15, 50.00, 19.00, 750.00, 142.50, 1
    );
    
    -- Achat 3 (il y a 90 jours) - 20 unités
    v_po3_id := gen_random_uuid();
    INSERT INTO supplier_pos (
        id, business_id, supplier_id, po_number, status,
        total_ht, total_tax, total_ttc, created_at, updated_at
    ) VALUES (
        v_po3_id, v_business_id, v_supplier_id,
        'PO-ML-003', 'completed',
        1000.00, 190.00, 1190.00,
        NOW() - INTERVAL '90 days',
        NOW() - INTERVAL '90 days'
    );
    
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po3_id, v_product1_id, 'Produit Test 1',
        20, 20, 50.00, 19.00, 1000.00, 190.00, 1
    );
    
    -- Achat 4 (il y a 60 jours) - 25 unités
    v_po4_id := gen_random_uuid();
    INSERT INTO supplier_pos (
        id, business_id, supplier_id, po_number, status,
        total_ht, total_tax, total_ttc, created_at, updated_at
    ) VALUES (
        v_po4_id, v_business_id, v_supplier_id,
        'PO-ML-004', 'completed',
        1250.00, 237.50, 1487.50,
        NOW() - INTERVAL '60 days',
        NOW() - INTERVAL '60 days'
    );
    
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po4_id, v_product1_id, 'Produit Test 1',
        25, 25, 50.00, 19.00, 1250.00, 237.50, 1
    );
    
    -- Achat 5 (il y a 30 jours) - 30 unités
    v_po5_id := gen_random_uuid();
    INSERT INTO supplier_pos (
        id, business_id, supplier_id, po_number, status,
        total_ht, total_tax, total_ttc, created_at, updated_at
    ) VALUES (
        v_po5_id, v_business_id, v_supplier_id,
        'PO-ML-005', 'completed',
        1500.00, 285.00, 1785.00,
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '30 days'
    );
    
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po5_id, v_product1_id, 'Produit Test 1',
        30, 30, 50.00, 19.00, 1500.00, 285.00, 1
    );
    
    -- ═══════════════════════════════════════════════════════════════════════════
    -- PRODUIT 2: Historique de 4 achats (tendance stable)
    -- ═══════════════════════════════════════════════════════════════════════════
    
    -- Achat 1 (il y a 120 jours) - 50 unités
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po1_id, v_product2_id, 'Produit Test 2',
        50, 50, 30.00, 19.00, 1500.00, 285.00, 2
    );
    
    -- Achat 2 (il y a 90 jours) - 48 unités
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po2_id, v_product2_id, 'Produit Test 2',
        48, 48, 30.00, 19.00, 1440.00, 273.60, 2
    );
    
    -- Achat 3 (il y a 60 jours) - 52 unités
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po3_id, v_product2_id, 'Produit Test 2',
        52, 52, 30.00, 19.00, 1560.00, 296.40, 2
    );
    
    -- Achat 4 (il y a 30 jours) - 50 unités
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po4_id, v_product2_id, 'Produit Test 2',
        50, 50, 30.00, 19.00, 1500.00, 285.00, 2
    );
    
    -- ═══════════════════════════════════════════════════════════════════════════
    -- PRODUIT 3: Historique de 3 achats (minimum requis)
    -- ═══════════════════════════════════════════════════════════════════════════
    
    -- Achat 1 (il y a 90 jours) - 100 unités
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po1_id, v_product3_id, 'Produit Test 3',
        100, 100, 20.00, 19.00, 2000.00, 380.00, 3
    );
    
    -- Achat 2 (il y a 60 jours) - 120 unités
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po2_id, v_product3_id, 'Produit Test 3',
        120, 120, 20.00, 19.00, 2400.00, 456.00, 3
    );
    
    -- Achat 3 (il y a 30 jours) - 110 unités
    INSERT INTO supplier_po_items (
        id, supplier_po_id, product_id, description,
        quantity_ordered, quantity_received, unit_price_ht,
        tax_rate_value, line_total_ht, line_tax, sort_order
    ) VALUES (
        gen_random_uuid(), v_po3_id, v_product3_id, 'Produit Test 3',
        110, 110, 20.00, 19.00, 2200.00, 418.00, 3
    );
    
    -- Mettre à jour les totaux des POs
    UPDATE supplier_pos SET 
        total_ht = (SELECT SUM(line_total_ht) FROM supplier_po_items WHERE supplier_po_id = supplier_pos.id),
        total_tax = (SELECT SUM(line_tax) FROM supplier_po_items WHERE supplier_po_id = supplier_pos.id),
        total_ttc = (SELECT SUM(line_total_ht + line_tax) FROM supplier_po_items WHERE supplier_po_id = supplier_pos.id)
    WHERE id IN (v_po1_id, v_po2_id, v_po3_id, v_po4_id, v_po5_id);
    
    RAISE NOTICE '✅ Données de test ML insérées avec succès!';
    RAISE NOTICE '📊 Produit 1: 5 achats (tendance croissante)';
    RAISE NOTICE '📊 Produit 2: 4 achats (tendance stable)';
    RAISE NOTICE '📊 Produit 3: 3 achats (minimum requis)';
    
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAPE 3: Vérifier les données insérées
-- ═══════════════════════════════════════════════════════════════════════════

-- Vérifier les bons de commande créés:
-- SELECT po.po_number, po.status, po.created_at, po.total_ttc
-- FROM supplier_pos po
-- WHERE po.po_number LIKE 'PO-ML-%'
-- ORDER BY po.created_at;

-- Vérifier les items par produit:
-- SELECT p.name, COUNT(poi.id) as nb_achats, SUM(poi.quantity_ordered) as total_qty
-- FROM products p
-- JOIN supplier_po_items poi ON poi.product_id = p.id
-- JOIN supplier_pos po ON po.id = poi.supplier_po_id
-- WHERE po.status IN ('approved', 'received', 'completed')
-- GROUP BY p.id, p.name
-- HAVING COUNT(poi.id) >= 3
-- ORDER BY nb_achats DESC;
