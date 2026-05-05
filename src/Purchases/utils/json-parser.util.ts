// src/Purchases/utils/json-parser.util.ts
//
// Utilitaire de parsing JSON robuste pour les réponses IA
// Gère les erreurs courantes de formatage de Gemini

import { Logger } from '@nestjs/common';

const logger = new Logger('JsonParserUtil');

/**
 * Parse une réponse JSON de Gemini avec plusieurs stratégies de réparation
 */
export function parseGeminiJson(aiText: string): any {
  // Étape 1: Nettoyage de base
  let cleaned = aiText
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .replace(/[\u201C\u201D]/g, '"')  // Guillemets typographiques
    .replace(/[\u2018\u2019]/g, "'")  // Apostrophes typographiques
    .replace(/[\u2013\u2014]/g, '-')  // Tirets longs
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')  // Supprimer les caractères de contrôle
    .replace(/\n/g, ' ')  // Remplacer les sauts de ligne par des espaces
    .replace(/\s+/g, ' ')  // Normaliser les espaces multiples
    .trim();

  // Stratégie 1: Parsing direct
  try {
    return JSON.parse(cleaned);
  } catch (error1) {
    logger.debug(`Stratégie 1 échouée: ${(error1 as Error).message}`);
  }

  // Stratégie 1.5: Remplacer les valeurs null non-JSON par des chaînes vides
  try {
    const fixedNulls = cleaned
      .replace(/:\s*null\s*([,}])/g, ': ""$1')  // null -> ""
      .replace(/:\s*undefined\s*([,}])/g, ': ""$1');  // undefined -> ""
    return JSON.parse(fixedNulls);
  } catch (error1_5) {
    logger.debug(`Stratégie 1.5 échouée: ${(error1_5 as Error).message}`);
  }

  // Stratégie 2: Extraire le JSON entre accolades
  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error2) {
    logger.debug(`Stratégie 2 échouée: ${(error2 as Error).message}`);
  }

  // Stratégie 3: Réparer les guillemets non échappés dans les valeurs
  try {
    // Remplacer les guillemets non échappés à l'intérieur des valeurs
    const repaired = cleaned.replace(
      /"([^"]*)":\s*"([^"]*)"/g,
      (match, key, value) => {
        // Échapper les guillemets dans la valeur
        const escapedValue = value.replace(/"/g, '\\"');
        return `"${key}": "${escapedValue}"`;
      }
    );
    return JSON.parse(repaired);
  } catch (error3) {
    logger.debug(`Stratégie 3 échouée: ${(error3 as Error).message}`);
  }

  // Stratégie 4: Supprimer les virgules en trop
  try {
    const noTrailingCommas = cleaned
      .replace(/,(\s*[}\]])/g, '$1')  // Virgules avant } ou ]
      .replace(/,(\s*,)/g, ',');       // Virgules doubles
    return JSON.parse(noTrailingCommas);
  } catch (error4) {
    logger.debug(`Stratégie 4 échouée: ${(error4 as Error).message}`);
  }

  // Stratégie 5: Réparer les sauts de ligne dans les chaînes
  try {
    const noNewlines = cleaned.replace(/"\s*\n\s*"/g, '" "');
    return JSON.parse(noNewlines);
  } catch (error5) {
    logger.debug(`Stratégie 5 échouée: ${(error5 as Error).message}`);
  }

  // Stratégie 6: Parser ligne par ligne pour identifier le problème
  try {
    const lines = cleaned.split('\n');
    let validJson = '';
    let braceCount = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      braceCount += (trimmed.match(/\{/g) || []).length;
      braceCount -= (trimmed.match(/\}/g) || []).length;
      
      validJson += trimmed + '\n';
      
      // Si on a fermé toutes les accolades, on arrête
      if (braceCount === 0 && validJson.includes('{')) {
        break;
      }
    }
    
    return JSON.parse(validJson);
  } catch (error6) {
    logger.debug(`Stratégie 6 échouée: ${(error6 as Error).message}`);
  }

  // Stratégie 7: Utiliser une regex plus permissive pour extraire les données
  try {
    const keyValuePairs: Record<string, any> = {};
    
    // Extraire les paires clé-valeur simples
    const stringPattern = /"([^"]+)":\s*"([^"]*)"/g;
    const numberPattern = /"([^"]+)":\s*(\d+\.?\d*)/g;
    const boolPattern = /"([^"]+)":\s*(true|false)/g;
    const arrayPattern = /"([^"]+)":\s*\[([^\]]*)\]/g;
    
    let match;
    
    // Strings
    while ((match = stringPattern.exec(cleaned)) !== null) {
      keyValuePairs[match[1]] = match[2];
    }
    
    // Numbers
    while ((match = numberPattern.exec(cleaned)) !== null) {
      keyValuePairs[match[1]] = parseFloat(match[2]);
    }
    
    // Booleans
    while ((match = boolPattern.exec(cleaned)) !== null) {
      keyValuePairs[match[1]] = match[2] === 'true';
    }
    
    // Arrays (simple)
    while ((match = arrayPattern.exec(cleaned)) !== null) {
      const items = match[2].split(',').map(item => 
        item.trim().replace(/^"|"$/g, '')
      );
      keyValuePairs[match[1]] = items;
    }
    
    if (Object.keys(keyValuePairs).length > 0) {
      logger.warn('Utilisation du parsing permissif - données partielles');
      return keyValuePairs;
    }
  } catch (error7) {
    logger.debug(`Stratégie 7 échouée: ${(error7 as Error).message}`);
  }

  // Toutes les stratégies ont échoué
  logger.error(`Impossible de parser le JSON après 7 tentatives`);
  logger.debug(`JSON reçu (complet): ${cleaned}`);
  
  // Retourner un objet vide pour que l'appelant gère l'erreur
  logger.warn('Retour d\'un objet vide - parsing impossible');
  return {};
}

/**
 * Parse avec valeurs par défaut en cas d'échec
 */
export function parseGeminiJsonSafe<T>(aiText: string, defaultValue: T): T {
  try {
    return parseGeminiJson(aiText) as T;
  } catch (error) {
    logger.warn(`Parsing échoué, utilisation des valeurs par défaut`);
    return defaultValue;
  }
}
