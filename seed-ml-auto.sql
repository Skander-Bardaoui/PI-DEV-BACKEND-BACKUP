-- ═══════════════════════════════════════════════════════════════════════════
-- Script AUTOMATIQUE d'insertion de données ML
-- ═══════════════════════════════════════════════════════════════════════════
-- Ce script utilise automatiquement vos données existantes
-- Pas besoin de modifier les IDs manuellement !
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_business_id UUID;
    v_supplier_id UUID;
    v_product1_id UUID;
    v_product2_id UUID;
    v_product3_id UUID;
    v_po_id UUID;
    v_counter INT := 0;
BEGIN
    -- ═══════════════════════════════════════════════════════════════════════════
    -- RÉCUPÉRATION AUTOMATIQUE DES IDs
    -- ═══════════════════════════════════════════════════════════════════════════
    
    -- Récupérer le premier business
    SELECT id INTO v_business_id FROM businesses ORDER BY created_at DESC LIMIT 1;
    
    IF v_business_id IS NULL THEN
        RAISE EXCEPTION '❌ Aucun business trouvé. Créez d''abord un business dans l''application.';
    END IF;
    
    RAISE NOTICE '✅ Business trouvé: %', v_business_id;
    
    -- Récupérer ou créer un fournisseur
    SELECT id INTO v_supplier_id FROM suppliers ORDER BY created_at DESC LIMIT 1;
    
    IF v_supplier_id IS NULL THEN
        -- Créer un fournisseur de test
        v_supplier_id := gen_random_uuid();
        INSERT INTO suppliers (id, name, email, phone, address, created_at, updated_at)
        VALUES (
            v_supplier_id,
            'Fournisseur Test ML',
            'test-ml@supplier.com',
            '+216 12 345 678',
            'Tunis, Tunisie',
            NOW(),
            NOW()
        );
        RAISE NOTICE '✅ Fournisseur créé: %', v_supplier_id;
    ELSE
        RAISE NOTICE '✅ Fournisseur trouvé: %', v_supplier_id;
    END IF;
    
    -- Récupérer 3 produits existants
    SELECT id INTO v_product1_id FROM products ORDER BY created_at DESC LIMIT 1 OFFSET 0;
    SELECT id INTO v_product2_id FROM products ORDER BY created_at DESC LIMIT 1 OFFSET 1;
    SELECT id INTO v_product3_id FROM products ORDER BY created_at DESC LIMIT 1 OFFSET 2;
    
    IF v_product1_id IS NULL OR v_product2_id IS NULL OR v_product3_id IS NULL THEN
        RAISE EXCEPTION '❌ Pas assez de produits (besoin de 3). Créez des produits dans l''application d''abord.';
    END IF;
    
    RAISE NOTICE '✅ Produits trouvés: %, %, %', v_product1_id, v_product2_id, v_product3_id;
    
    -- ═══════════════════════════════════════════════════════════════════════════
    -- CRÉATION DES BONS DE COMMANDE AVEC HISTORIQUE
    -- ═══════════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '📦 Création de l''historique d''achats...';
    
    -- Produit 1: 5 achats (tendance croissante)
    FOR v_counter IN 1..5 LOOP
        v_po_id := gen_random_uuid();
        
        INSERT INTO supplier_pos (
            id, business_id, supplier_id, po_number, status,
            total_ht, total_tax, total_ttc, created_at, updated_at
        ) VALUES (
            v_po_id,
            v_business_id,
            v_supplier_id,
            'PO-ML-AUTO-' || LPAD(v_counter::TEXT, 3, '0'),
            'completed',
            (10 + (v_counter - 1) * 5) * 50.00,  -- Quantité croissante × prix
            (10 + (v_counter - 1) * 5) * 50.00 * 0.19,
            (10 + (v_counter - 1) * 5) * 50.00 * 1.19,
            NOW() - INTERVAL '1 day' * (180 - v_counter * 30),
            NOW() - INTERVAL '1 day' * (180 - v_counter * 30)
        );
        
        INSERT INTO supplier_po_items (
            id, supplier_po_id, product_id, description,
            quantity_ordered, quantity_received, unit_price_ht,
            tax_rate_value, line_total_ht, line_tax, sort_order
        ) VALUES (
            gen_random_uuid(),
            v_po_id,
            v_product1_id,
            'Achat automatique ML - Produit 1',
            10 + (v_counter - 1) * 5,  -- 10, 15, 20, 25, 30
            10 + (v_counter - 1) * 5,
            50.00,
            19.00,
            (10 + (v_counter - 1) * 5) * 50.00,
            (10 + (v_counter - 1) * 5) * 50.00 * 0.19,
            1
        );
    END LOOP;
    
    RAISE NOTICE '  ✓ Produit 1: 5 achats créés (tendance croissante)';
    
    -- Produit 2: 4 achats (tendance stable)
    FOR v_counter IN 1..4 LOOP
        v_po_id := gen_random_uuid();
        
        INSERT INTO supplier_pos (
            id, business_id, supplier_id, po_number, status,
            total_ht, total_tax, total_ttc, created_at, updated_at
        ) VALUES (
            v_po_id,
            v_business_id,
            v_supplier_id,
            'PO-ML-AUTO-' || LPAD((100 + v_counter)::TEXT, 3, '0'),
            'completed',
            50 * 30.00,
            50 * 30.00 * 0.19,
            50 * 30.00 * 1.19,
            NOW() - INTERVAL '1 day' * (150 - v_counter * 30),
            NOW() - INTERVAL '1 day' * (150 - v_counter * 30)
        );
        
        INSERT INTO supplier_po_items (
            id, supplier_po_id, product_id, description,
            quantity_ordered, quantity_received, unit_price_ht,
            tax_rate_value, line_total_ht, line_tax, sort_order
        ) VALUES (
            gen_random_uuid(),
            v_po_id,
            v_product2_id,
            'Achat automatique ML - Produit 2',
            50,  -- Quantité stable
            50,
            30.00,
            19.00,
            50 * 30.00,
            50 * 30.00 * 0.19,
            1
        );
    END LOOP;
    
    RAISE NOTICE '  ✓ Produit 2: 4 achats créés (tendance stable)';
    
    -- Produit 3: 3 achats (minimum requis)
    FOR v_counter IN 1..3 LOOP
        v_po_id := gen_random_uuid();
        
        INSERT INTO supplier_pos (
            id, business_id, supplier_id, po_number, status,
            total_ht, total_tax, total_ttc, created_at, updated_at
        ) VALUES (
            v_po_id,
            v_business_id,
            v_supplier_id,
            'PO-ML-AUTO-' || LPAD((200 + v_counter)::TEXT, 3, '0'),
            'completed',
            (100 + v_counter * 10) * 20.00,
            (100 + v_counter * 10) * 20.00 * 0.19,
            (100 + v_counter * 10) * 20.00 * 1.19,
            NOW() - INTERVAL '1 day' * (120 - v_counter * 30),
            NOW() - INTERVAL '1 day' * (120 - v_counter * 30)
        );
        
        INSERT INTO supplier_po_items (
            id, supplier_po_id, product_id, description,
            quantity_ordered, quantity_received, unit_price_ht,
            tax_rate_value, line_total_ht, line_tax, sort_order
        ) VALUES (
            gen_random_uuid(),
            v_po_id,
            v_product3_id,
            'Achat automatique ML - Produit 3',
            100 + v_counter * 10,  -- 110, 120, 130
            100 + v_counter * 10,
            20.00,
            19.00,
            (100 + v_counter * 10) * 20.00,
            (100 + v_counter * 10) * 20.00 * 0.19,
            1
        );
    END LOOP;
    
    RAISE NOTICE '  ✓ Produit 3: 3 achats créés (minimum requis)';
    
    -- ═══════════════════════════════════════════════════════════════════════════
    -- RÉSUMÉ
    -- ═══════════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ DONNÉES ML INSÉRÉES AVEC SUCCÈS !';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Résumé:';
    RAISE NOTICE '  • 12 bons de commande créés';
    RAISE NOTICE '  • 3 produits avec historique suffisant';
    RAISE NOTICE '  • Période: 180 jours d''historique';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Prochaines étapes:';
    RAISE NOTICE '  1. Démarrer le service ML (port 8000)';
    RAISE NOTICE '  2. Redémarrer le backend (port 3001)';
    RAISE NOTICE '  3. Aller dans: Purchases → Prédictions ML';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    
END $$;

-- Vérification finale
SELECT 
    '✅ VÉRIFICATION' as titre,
    COUNT(DISTINCT po.id) as bons_commande_crees,
    COUNT(DISTINCT poi.product_id) as produits_avec_historique,
    SUM(po.total_ttc) as valeur_totale
FROM supplier_pos po
JOIN supplier_po_items poi ON poi.supplier_po_id = po.id
WHERE po.po_number LIKE 'PO-ML-AUTO-%';
