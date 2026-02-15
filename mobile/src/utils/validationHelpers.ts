import * as yup from "yup";

/**
 * Validation helper utilities for form validation
 * These utilities provide reusable validation functions and error handling
 */

/**
 * Validates a single field against a schema
 * @param schema - Yup schema to validate against
 * @param field - Field name to validate
 * @param value - Value to validate
 * @returns Error message string or undefined if valid
 *
 * @example
 * const error = await validateSingleField(loginSchema, 'email', 'test@example.com');
 * if (error) {
 *   console.log(error); // "Email is required" or validation message
 * }
 */
export const validateSingleField = async (
  schema: yup.AnySchema,
  field: string,
  value: any
): Promise<string | undefined> => {
  try {
    await schema.validateAt(field, { [field]: value });
    return undefined;
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return error.message;
    }
    return undefined;
  }
};

/**
 * Validates an entire form object and returns all errors
 * @param schema - Yup schema to validate against
 * @param values - Form values object
 * @returns Object with field names as keys and error messages as values
 *
 * @example
 * const errors = await validateEntireForm(loginSchema, { email: '', password: '' });
 * // Returns: { email: "Email is required", password: "Password is required" }
 */
export const validateEntireForm = async <T extends Record<string, any>>(
  schema: yup.AnySchema,
  values: T
): Promise<Partial<Record<keyof T, string>>> => {
  try {
    await schema.validate(values, { abortEarly: false });
    return {};
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      const errors: Record<string, string> = {};
      error.inner.forEach((err) => {
        if (err.path) {
          errors[err.path] = err.message;
        }
      });
      return errors as Partial<Record<keyof T, string>>;
    }
    return {};
  }
};

/**
 * Validates a form and returns a boolean indicating if it's valid
 * @param schema - Yup schema to validate against
 * @param values - Form values object
 * @returns True if valid, false otherwise
 *
 * @example
 * const isValid = await isFormValid(loginSchema, formValues);
 * if (isValid) {
 *   // Submit form
 * }
 */
export const isFormValid = async (
  schema: yup.AnySchema,
  values: any
): Promise<boolean> => {
  try {
    await schema.validate(values, { abortEarly: true });
    return true;
  } catch {
    return false;
  }
};

/**
 * Custom validation for email format (additional to yup)
 * Checks for common email issues like double dots, spaces, etc.
 */
export const isValidEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const hasInvalidChars = /[<>()[\]\\,;:\s@"]/.test(email.split("@")[0] || "");
  const hasDoubleDots = /\.\./.test(email);

  return emailRegex.test(email) && !hasInvalidChars && !hasDoubleDots;
};

/**
 * Password strength calculator
 * @param password - Password to check
 * @returns Object with strength level and suggestions
 */
export const calculatePasswordStrength = (
  password: string
): {
  strength: "weak" | "fair" | "good" | "strong";
  score: number;
  suggestions: string[];
} => {
  let score = 0;
  const suggestions: string[] = [];

  // Length check
  if (password.length >= 8) score += 1;
  else suggestions.push("Use at least 8 characters");

  if (password.length >= 12) score += 1;

  // Complexity checks
  if (/[a-z]/.test(password)) score += 1;
  else suggestions.push("Add lowercase letters");

  if (/[A-Z]/.test(password)) score += 1;
  else suggestions.push("Add uppercase letters");

  if (/\d/.test(password)) score += 1;
  else suggestions.push("Add numbers");

  if (/[!@#$%^&*]/.test(password)) score += 1;
  else suggestions.push("Add special characters (!@#$%^&*)");

  // Determine strength
  let strength: "weak" | "fair" | "good" | "strong";
  if (score <= 2) strength = "weak";
  else if (score <= 3) strength = "fair";
  else if (score <= 4) strength = "good";
  else strength = "strong";

  return { strength, score, suggestions };
};

/**
 * Sanitizes user input by removing potentially harmful characters
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, "") // Remove HTML tags
    .replace(/[{}]/g, "") // Remove curly braces
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .trim();
};

/**
 * Validates phone number format (international)
 * @param phone - Phone number to validate
 * @returns True if valid format
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  // Matches international phone numbers with optional + prefix
  const phoneRegex =
    /^(\+?\d{1,4}[\s-]?)?(\(?\d{1,4}\)?[\s-]?)?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/;
  return phoneRegex.test(phone);
};

/**
 * Formats validation errors for display
 * @param errors - Formik errors object
 * @param touched - Formik touched object
 * @returns Array of error messages
 */
export const formatValidationErrors = <T extends Record<string, any>>(
  errors: Partial<Record<keyof T, string>>,
  touched: Partial<Record<keyof T, boolean>>
): string[] => {
  const errorMessages: string[] = [];

  Object.keys(errors).forEach((key) => {
    if (touched[key as keyof T] && errors[key as keyof T]) {
      errorMessages.push(errors[key as keyof T] as string);
    }
  });

  return errorMessages;
};

/**
 * Checks if a field has been touched and has an error
 * @param fieldName - Name of the field
 * @param errors - Formik errors object
 * @param touched - Formik touched object
 * @returns Error message or undefined
 */
export const getFieldError = <T extends Record<string, any>>(
  fieldName: keyof T,
  errors: Partial<Record<keyof T, string>>,
  touched: Partial<Record<keyof T, boolean>>
): string | undefined => {
  if (touched[fieldName] && errors[fieldName]) {
    return errors[fieldName];
  }
  return undefined;
};

/**
 * Common validation regex patterns
 */
export const ValidationPatterns = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE:
    /^(\+?\d{1,4}[\s-]?)?(\(?\d{1,4}\)?[\s-]?)?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/,
  PASSWORD_STRONG:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  PASSWORD_MEDIUM: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/,
  LETTERS_ONLY: /^[a-zA-Z\s'-]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  NUMBERS_ONLY: /^\d+$/,
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
};
