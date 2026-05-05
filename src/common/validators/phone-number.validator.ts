import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
export class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(phoneNumber: any, args: ValidationArguments) {
    if (typeof phoneNumber !== 'string') {
      return false;
    }

    // Check if it starts with +
    if (!phoneNumber.startsWith('+')) {
      return false;
    }

    // Validate using libphonenumber-js
    try {
      return isValidPhoneNumber(phoneNumber);
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return 'Le numéro de téléphone doit être au format international valide (ex: +21612345678)';
  }
}

/**
 * Decorator to validate international phone numbers in E.164 format
 * 
 * @example
 * ```typescript
 * class RegisterDto {
 *   @IsValidInternationalPhone()
 *   phone: string;
 * }
 * ```
 * 
 * Valid formats:
 * - +21612345678 (Tunisia)
 * - +33612345678 (France)
 * - +14155552671 (USA)
 */
export function IsValidInternationalPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneNumberConstraint,
    });
  };
}

/**
 * Helper function to format phone number to E.164
 * @param phoneNumber - Phone number string
 * @returns Formatted phone number in E.164 format or null if invalid
 */
export function formatToE164(phoneNumber: string): string | null {
  try {
    const parsed = parsePhoneNumber(phoneNumber);
    if (parsed && isValidPhoneNumber(phoneNumber)) {
      return parsed.format('E.164');
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Helper function to get phone number details
 * @param phoneNumber - Phone number in E.164 format
 * @returns Phone number details or null if invalid
 */
export function getPhoneNumberDetails(phoneNumber: string): {
  country: string;
  countryCallingCode: string;
  nationalNumber: string;
  isValid: boolean;
} | null {
  try {
    const parsed = parsePhoneNumber(phoneNumber);
    if (parsed) {
      return {
        country: parsed.country || '',
        countryCallingCode: `+${parsed.countryCallingCode}`,
        nationalNumber: parsed.nationalNumber,
        isValid: isValidPhoneNumber(phoneNumber),
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}
