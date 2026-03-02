/**
 * Lightweight client-side validation utilities for auth forms.
 * Zero external dependencies — uses native regex and string checks.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_STRENGTH_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;

export type FieldErrors = Record<string, string>;

export function validateLogin(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  }
  return errors;
}

export function validateRegister(fields: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!fields.firstName.trim()) {
    errors.firstName = 'First name is required.';
  } else if (fields.firstName.trim().length < 2) {
    errors.firstName = 'First name must be at least 2 characters.';
  }
  if (!fields.lastName.trim()) {
    errors.lastName = 'Last name is required.';
  } else if (fields.lastName.trim().length < 2) {
    errors.lastName = 'Last name must be at least 2 characters.';
  }
  if (!fields.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(fields.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!fields.password) {
    errors.password = 'Password is required.';
  } else if (fields.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  } else if (fields.password.length > 128) {
    errors.password = 'Password must be under 128 characters.';
  } else if (!PASSWORD_STRENGTH_RE.test(fields.password)) {
    errors.password = 'Must include upper, lower, number, and a special character (!@#$%^&*).';
  }
  return errors;
}

export function validateForgotPassword(email: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  return errors;
}

export function validateResetPassword(password: string, confirmPassword: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  } else if (password.length > 128) {
    errors.password = 'Password must be under 128 characters.';
  } else if (!PASSWORD_STRENGTH_RE.test(password)) {
    errors.password = 'Must include upper, lower, number, and a special character (!@#$%^&*).';
  }
  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

export function validateAdvertiserCampaign(fields: {
  name: string;
  packageId: string;
  headline: string;
  ctaUrl: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!fields.name.trim()) {
    errors.name = 'Campaign name is required.';
  }
  if (!fields.packageId) {
    errors.packageId = 'Package selection is required.';
  }
  if (!fields.headline.trim()) {
    errors.headline = 'Headline is required.';
  } else if (fields.headline.trim().length > 80) {
    errors.headline = 'Headline must be under 80 characters.';
  }
  if (!fields.ctaUrl.trim()) {
    errors.ctaUrl = 'CTA URL is required.';
  } else if (!/^https?:\/\/.+/.test(fields.ctaUrl.trim())) {
    errors.ctaUrl = 'Must be a valid URL starting with http(s).';
  }
  return errors;
}

/** Returns true when no errors exist */
export function isValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0;
}
