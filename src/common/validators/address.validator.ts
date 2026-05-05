import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Tunisian Postal Code Validation Rules
 * Format: 4 digits (XXXX)
 * First digit indicates the governorate
 */
const TUNISIAN_POSTAL_CODE_PATTERNS: Record<string, RegExp> = {
  // Tunis governorate: 1xxx
  tunis: /^1\d{3}$/i,
  // Ariana: 2xxx
  ariana: /^2\d{3}$/i,
  // Ben Arous: 2xxx
  'ben arous': /^2\d{3}$/i,
  // Manouba: 2xxx
  manouba: /^2\d{3}$/i,
  // Nabeul: 8xxx
  nabeul: /^8\d{3}$/i,
  // Zaghouan: 1xxx
  zaghouan: /^1\d{3}$/i,
  // Bizerte: 7xxx
  bizerte: /^7\d{3}$/i,
  // Béja: 9xxx
  beja: /^9\d{3}$/i,
  'béja': /^9\d{3}$/i,
  // Jendouba: 8xxx
  jendouba: /^8\d{3}$/i,
  // Kef: 7xxx
  kef: /^7\d{3}$/i,
  'le kef': /^7\d{3}$/i,
  // Siliana: 6xxx
  siliana: /^6\d{3}$/i,
  // Sousse: 4xxx
  sousse: /^4\d{3}$/i,
  // Monastir: 5xxx
  monastir: /^5\d{3}$/i,
  // Mahdia: 5xxx
  mahdia: /^5\d{3}$/i,
  // Sfax: 3xxx
  sfax: /^3\d{3}$/i,
  // Kairouan: 3xxx
  kairouan: /^3\d{3}$/i,
  // Kasserine: 1xxx or 2xxx
  kasserine: /^[12]\d{3}$/i,
  // Sidi Bouzid: 9xxx
  'sidi bouzid': /^9\d{3}$/i,
  // Gabès: 6xxx
  gabes: /^6\d{3}$/i,
  'gabès': /^6\d{3}$/i,
  // Medenine: 4xxx
  medenine: /^4\d{3}$/i,
  'médenine': /^4\d{3}$/i,
  // Tataouine: 3xxx
  tataouine: /^3\d{3}$/i,
  // Gafsa: 2xxx
  gafsa: /^2\d{3}$/i,
  // Tozeur: 2xxx
  tozeur: /^2\d{3}$/i,
  // Kebili: 4xxx
  kebili: /^4\d{3}$/i,
  'kébili': /^4\d{3}$/i,
};

/**
 * Validates Tunisian postal code format
 */
export function isValidTunisianPostalCode(postalCode: string): boolean {
  if (!postalCode) return false;
  const trimmed = postalCode.trim();
  return /^\d{4}$/.test(trimmed);
}

/**
 * Validates that postal code matches the city (Tunisia-specific)
 */
export function validatePostalCodeForCity(
  city: string,
  postalCode: string,
): { isValid: boolean; message?: string } {
  if (!city || !postalCode) {
    return { isValid: false, message: 'City and postal code are required' };
  }

  const normalizedCity = city.toLowerCase().trim();
  const normalizedPostalCode = postalCode.trim();

  // Check if it's a valid Tunisian postal code format
  if (!isValidTunisianPostalCode(normalizedPostalCode)) {
    return {
      isValid: false,
      message: 'Le code postal tunisien doit contenir exactement 4 chiffres',
    };
  }

  // Find matching pattern for the city
  const pattern = TUNISIAN_POSTAL_CODE_PATTERNS[normalizedCity];

  if (pattern) {
    if (!pattern.test(normalizedPostalCode)) {
      return {
        isValid: false,
        message: `Le code postal ne correspond pas à la ville ${city}`,
      };
    }
  }

  // If no specific pattern found, accept any valid 4-digit code
  // (for smaller cities or international addresses)
  return { isValid: true };
}

/**
 * Validates address using Nominatim reverse geocoding
 */
export async function validateAddressWithNominatim(
  street: string,
  city: string,
  postalCode: string,
  country: string,
): Promise<{ isValid: boolean; message?: string; details?: any }> {
  try {
    // Build search query
    const query = `${street}, ${city}, ${postalCode}, ${country}`;

    // Call Nominatim API
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}` +
        `&format=json` +
        `&addressdetails=1` +
        `&limit=1`,
      {
        headers: {
          'User-Agent': 'NovEntra-SaaS-Platform/1.0',
          'Accept-Language': 'fr',
        },
      },
    );

    if (!response.ok) {
      return {
        isValid: false,
        message: 'Unable to validate address with geocoding service',
      };
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return {
        isValid: false,
        message: 'Address not found. Please verify your address details.',
      };
    }

    const result = data[0];
    const address = result.address || {};

    // Extract details
    const foundCity =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      '';
    const foundPostalCode = address.postcode || '';
    const foundCountry = address.country || '';

    // Validate city match (fuzzy match)
    const cityMatch =
      foundCity.toLowerCase().includes(city.toLowerCase()) ||
      city.toLowerCase().includes(foundCity.toLowerCase());

    // Validate postal code match (exact or prefix match)
    const postalCodeMatch =
      foundPostalCode === postalCode ||
      foundPostalCode.startsWith(postalCode) ||
      postalCode.startsWith(foundPostalCode);

    // Validate country match
    const countryMatch =
      foundCountry.toLowerCase().includes(country.toLowerCase()) ||
      country.toLowerCase().includes(foundCountry.toLowerCase());

    if (!cityMatch) {
      return {
        isValid: false,
        message: `La ville "${city}" ne correspond pas à l'adresse trouvée`,
        details: { foundCity, foundPostalCode, foundCountry },
      };
    }

    if (!postalCodeMatch && foundPostalCode) {
      return {
        isValid: false,
        message: `Le code postal "${postalCode}" ne correspond pas à l'adresse trouvée`,
        details: { foundCity, foundPostalCode, foundCountry },
      };
    }

    if (!countryMatch) {
      return {
        isValid: false,
        message: `Le pays "${country}" ne correspond pas à l'adresse trouvée`,
        details: { foundCity, foundPostalCode, foundCountry },
      };
    }

    return {
      isValid: true,
      details: {
        foundCity,
        foundPostalCode,
        foundCountry,
        latitude: result.lat,
        longitude: result.lon,
      },
    };
  } catch (error) {
    console.error('Nominatim validation error:', error);
    return {
      isValid: false,
      message: 'Error validating address. Please try again.',
    };
  }
}

/**
 * Custom validator constraint for postal code and city consistency
 */
@ValidatorConstraint({ name: 'isPostalCodeMatchingCity', async: false })
export class IsPostalCodeMatchingCityConstraint
  implements ValidatorConstraintInterface
{
  validate(postalCode: string, args: ValidationArguments) {
    const object = args.object as any;
    const city = object.city || object.address?.city;

    if (!city || !postalCode) {
      return true; // Let @IsNotEmpty handle this
    }

    const result = validatePostalCodeForCity(city, postalCode);
    return result.isValid;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const city = object.city || object.address?.city;
    const postalCode = args.value;

    const result = validatePostalCodeForCity(city, postalCode);
    return result.message || 'Postal code does not match the city';
  }
}

/**
 * Decorator for postal code and city validation
 */
export function IsPostalCodeMatchingCity(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPostalCodeMatchingCityConstraint,
    });
  };
}

/**
 * Helper function to validate complete address
 */
export function validateCompleteAddress(address: {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!address.street?.trim()) {
    errors.push('Street address is required');
  }
  if (!address.city?.trim()) {
    errors.push('City is required');
  }
  if (!address.postalCode?.trim()) {
    errors.push('Postal code is required');
  }
  if (!address.country?.trim()) {
    errors.push('Country is required');
  }

  // If Tunisia, validate postal code format and city match
  if (
    address.country?.toLowerCase().includes('tunis') ||
    address.country?.toLowerCase() === 'tn'
  ) {
    if (!isValidTunisianPostalCode(address.postalCode)) {
      errors.push('Invalid Tunisian postal code format (must be 4 digits)');
    } else {
      const result = validatePostalCodeForCity(
        address.city,
        address.postalCode,
      );
      if (!result.isValid && result.message) {
        errors.push(result.message);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
