-- ═══════════════════════════════════════════════════════════════════════════
-- Script de Vérification des Données ML
-- ═══════════════════════════════════════════════════════════════════════════
-- Ce script vérifie si vous avez déjà des données suffisantes pour le ML
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Vérifier les businesses disponibles
SELECT 
    '🏢 BUSINESSES DISPONIBLES' as info,
    id,
    name,
    created_at
FROM businesses
ORDER BY created_at DESC
LIMIT 5;

-- 2. Vérifier les fournisseurs disponibles
SELECT 
    '👥 FOURNISSEURS DISPONIBLES' as info,
    id,
    name,
    email
FROM suppliers
ORDER BY created_at DESC
LIMIT 5;

-- 3. Vérifier les produits disponibles
SELECT 
    '📦 PRODUITS DISPONIBLES' as info,
    id,
    name,
    category,
    unit_price
FROM products
ORDER BY created_at DESC
LIMIT 10;

-- 4. Vérifier les produits avec historique d'achat suffisant (≥3 achats)
SELECT 
    '✅ PRODUITS AVEC HISTORIQUE SUFFISANT (≥3 achats)' as info,
    p.id,
    p.name as produit,
    p.category,
    COUNT(DISTINCT poi.id) as nb_achats,
    SUM(poi.quantity_ordered) as total_quantite,
    AVG(poi.unit_price_ht) as prix_moyen,
    MIN(po.created_at) as premier_achat,
    MAX(po.created_at) as dernier_achat,
    EXTRACT(DAY FROM (MAX(po.created_at) - MIN(po.created_at))) as jours_historique
FROM products p
JOIN supplier_po_items poi ON poi.product_id = p.id
JOIN supplier_pos po ON po.id = poi.supplier_po_id
WHERE po.status IN ('approved', 'received', 'completed')
GROUP BY p.id, p.name, p.category
HAVING COUNT(DISTINCT poi.id) >= 3
ORDER BY nb_achats DESC;

-- 5. Vérifier les produits avec historique insuffisant (<3 achats)
SELECT 
    '⚠️ PRODUITS AVEC HISTORIQUE INSUFFISANT (<3 achats)' as info,
    p.id,
    p.name as produit,
    COUNT(DISTINCT poi.id) as nb_achats,
    3 - COUNT(DISTINCT poi.id) as achats_manquants
FROM products p
LEFT JOIN supplier_po_items poi ON poi.product_id = p.id
LEFT JOIN supplier_pos po ON po.id = poi.supplier_po_id AND po.status IN ('approved', 'received', 'completed')
GROUP BY p.id, p.name
HAVING COUNT(DISTINCT poi.id) < 3
ORDER BY nb_achats DESC
LIMIT 10;

-- 6. Statistiques globales par business
SELECT 
    '📊 STATISTIQUES PAR BUSINESS' as info,
    b.id as business_id,
    b.name as business_name,
    COUNT(DISTINCT po.id) as nb_bons_commande,
    COUNT(DISTINCT poi.product_id) as nb_produits_achetes,
    COUNT(DISTINCT CASE WHEN product_achats.nb >= 3 THEN poi.product_id END) as nb_produits_ml_ready,
    SUM(po.total_ttc) as valeur_totale_achats
FROM businesses b
LEFT JOIN supplier_pos po ON po.business_id = b.id AND po.status IN ('approved', 'received', 'completed')
LEFT JOIN supplier_po_items poi ON poi.supplier_po_id = po.id
LEFT JOIN (
    SELECT 
        poi2.product_id,
        po2.business_id,
        COUNT(DISTINCT poi2.id) as nb
    FROM supplier_po_items poi2
    JOIN supplier_pos po2 ON po2.id = poi2.supplier_po_id
    WHERE po2.status IN ('approved', 'received', 'completed')
    GROUP BY poi2.product_id, po2.business_id
) product_achats ON product_achats.product_id = poi.product_id AND product_achats.business_id = b.id
GROUP BY b.id, b.name
ORDER BY nb_produits_ml_ready DESC;

-- 7. Détail des achats pour les produits ML-ready
SELECT 
    '📈 HISTORIQUE DÉTAILLÉ DES PRODUITS ML-READY' as info,
    p.name as produit,
    po.po_number,
    po.created_at::date as date_achat,
    poi.quantity_ordered as quantite,
    poi.unit_price_ht as prix_unitaire,
    s.name as fournisseur,
    po.status
FROM products p
JOIN supplier_po_items poi ON poi.product_id = p.id
JOIN supplier_pos po ON po.id = poi.supplier_po_id
LEFT JOIN suppliers s ON s.id = po.supplier_id
WHERE po.status IN ('approved', 'received', 'completed')
    AND p.id IN (
        SELECT product_id 
        FROM supplier_po_items poi2
        JOIN supplier_pos po2 ON po2.id = poi2.supplier_po_id
        WHERE po2.status IN ('approved', 'received', 'completed')
        GROUP BY product_id
        HAVING COUNT(DISTINCT poi2.id) >= 3
    )
ORDER BY p.name, po.created_at;

-- ═══════════════════════════════════════════════════════════════════════════
-- RÉSUMÉ
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
    '📋 RÉSUMÉ POUR ML' as titre,
    (SELECT COUNT(*) FROM businesses) as total_businesses,
    (SELECT COUNT(*) FROM suppliers) as total_fournisseurs,
    (SELECT COUNT(*) FROM products) as total_produits,
    (SELECT COUNT(DISTINCT p.id)
     FROM products p
     JOIN supplier_po_items poi ON poi.product_id = p.id
     JOIN supplier_pos po ON po.id = poi.supplier_po_id
     WHERE po.status IN ('approved', 'received', 'completed')
     GROUP BY p.id
     HAVING COUNT(DISTINCT poi.id) >= 3
    ) as produits_ml_ready,
    CASE 
        WHEN (SELECT COUNT(DISTINCT p.id)
              FROM products p
              JOIN supplier_po_items poi ON poi.product_id = p.id
              JOIN supplier_pos po ON po.id = poi.supplier_po_id
              WHERE po.status IN ('approved', 'received', 'completed')
              GROUP BY p.id
              HAVING COUNT(DISTINCT poi.id) >= 3
             ) >= 3 
        THEN '✅ Prêt pour ML'
        ELSE '⚠️ Données insuffisantes - Utilisez seed-ml-test-data.sql'
    END as statut;
