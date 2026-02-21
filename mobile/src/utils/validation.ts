import * as yup from "yup";

/**
 * Validation schemas using Yup for form validation
 * These schemas ensure data integrity before submitting to the API
 */

// ==================== LOGIN SCHEMA ====================
export const loginSchema = yup.object().shape({
  email: yup
    .string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .trim()
    .lowercase()
    .max(255, "Email must not exceed 255 characters"),
  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters"),
});

export type LoginFormValues = yup.InferType<typeof loginSchema>;

// ==================== REGISTER SCHEMA ====================
export const registerSchema = yup.object().shape({
  firstName: yup
    .string()
    .required("First name is required")
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/, "First name can only contain letters"),
  lastName: yup
    .string()
    .required("Last name is required")
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/, "Last name can only contain letters"),
  email: yup
    .string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .trim()
    .lowercase()
    .max(255, "Email must not exceed 255 characters"),
  phone: yup
    .string()
    .trim()
    .matches(
      /^(\+?\d{1,4}[\s-]?)?(\(?\d{1,4}\)?[\s-]?)?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/,
      {
        message: "Please enter a valid phone number",
        excludeEmptyString: true,
      }
    )
    .notRequired()
    .default(""),
  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      "Password must include upper, lower, number, and a special character (!@#$%^&*)"
    ),
  confirmPassword: yup
    .string()
    .required("Please confirm your password")
    .oneOf([yup.ref("password")], "Passwords must match"),
  referralCode: yup
    .string()
    .trim()
    .uppercase()
    .matches(/^[A-Z0-9]{4,20}$/, {
      message: "Referral code must be 4-20 characters (letters or numbers)",
      excludeEmptyString: true,
    })
    .notRequired()
    .default(""),
});

export type RegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
};

// ==================== PROFILE SCHEMA ====================
export const profileSchema = yup.object().shape({
  firstName: yup
    .string()
    .required("First name is required")
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/, "First name can only contain letters"),
  lastName: yup
    .string()
    .required("Last name is required")
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/, "Last name can only contain letters"),
  email: yup
    .string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .trim()
    .lowercase()
    .max(255, "Email must not exceed 255 characters"),
  phone: yup
    .string()
    .trim()
    .matches(
      /^(\+?\d{1,4}[\s-]?)?(\(?\d{1,4}\)?[\s-]?)?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/,
      {
        message: "Please enter a valid phone number",
        excludeEmptyString: true,
      }
    )
    .notRequired()
    .default(""),
  bio: yup
    .string()
    .trim()
    .max(500, "Bio must not exceed 500 characters")
    .notRequired()
    .default(""),
  targetBand: yup
    .number()
    .min(1, "Target band must be between 1 and 9")
    .max(9, "Target band must be between 1 and 9")
    .notRequired()
    .nullable(),
});

export type ProfileFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio?: string;
  targetBand?: number;
};

// ==================== PASSWORD CHANGE SCHEMA ====================
export const changePasswordSchema = yup.object().shape({
  currentPassword: yup
    .string()
    .required("Current password is required")
    .min(8, "Password must be at least 8 characters"),
  newPassword: yup
    .string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      "Password must include upper, lower, number, and a special character (!@#$%^&*)"
    )
    .notOneOf(
      [yup.ref("currentPassword")],
      "New password must be different from current password"
    ),
  confirmNewPassword: yup
    .string()
    .required("Please confirm your new password")
    .oneOf([yup.ref("newPassword")], "Passwords must match"),
});

export type ChangePasswordFormValues = yup.InferType<
  typeof changePasswordSchema
>;

// ==================== FORGOT PASSWORD SCHEMA ====================
export const forgotPasswordSchema = yup.object().shape({
  email: yup
    .string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .trim()
    .lowercase()
    .max(255, "Email must not exceed 255 characters"),
});

export type ForgotPasswordFormValues = yup.InferType<
  typeof forgotPasswordSchema
>;

// ==================== RESET PASSWORD SCHEMA ====================
export const resetPasswordSchema = yup.object().shape({
  code: yup
    .string()
    .required("Verification code is required")
    .length(6, "Verification code must be 6 digits")
    .matches(/^\d+$/, "Verification code must contain only numbers"),
  newPassword: yup
    .string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      "Password must include upper, lower, number, and a special character (!@#$%^&*)"
    ),
  confirmNewPassword: yup
    .string()
    .required("Please confirm your new password")
    .oneOf([yup.ref("newPassword")], "Passwords must match"),
});

export type ResetPasswordFormValues = yup.InferType<typeof resetPasswordSchema>;

// ==================== FEEDBACK SCHEMA ====================
export const feedbackSchema = yup.object().shape({
  subject: yup
    .string()
    .required("Subject is required")
    .trim()
    .min(5, "Subject must be at least 5 characters")
    .max(100, "Subject must not exceed 100 characters"),
  message: yup
    .string()
    .required("Message is required")
    .trim()
    .min(20, "Message must be at least 20 characters")
    .max(1000, "Message must not exceed 1000 characters"),
  email: yup
    .string()
    .email("Please enter a valid email address")
    .trim()
    .lowercase()
    .notRequired()
    .nullable(),
});

export type FeedbackFormValues = yup.InferType<typeof feedbackSchema>;

// ==================== REFERRAL CODE SCHEMA ====================
export const referralCodeSchema = yup.object().shape({
  referralCode: yup
    .string()
    .required("Referral code is required")
    .trim()
    .min(4, "Referral code must be at least 4 characters")
    .max(20, "Referral code must not exceed 20 characters")
    .matches(
      /^[A-Z0-9]+$/,
      "Referral code can only contain uppercase letters and numbers"
    )
    .uppercase(),
});

export type ReferralCodeFormValues = yup.InferType<typeof referralCodeSchema>;

// ==================== HELPER FUNCTIONS ====================

// ==================== HELPER FUNCTIONS ====================

/**
 * Validates a value against a schema and returns the error message if invalid
 * @param schema - Yup schema to validate against
 * @param field - Field name to validate
 * @param value - Value to validate
 * @returns Error message string or undefined if valid
 */
export const validateField = async (
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
 * Validates an entire form and returns all field errors
 * @param schema - Yup schema to validate against
 * @param values - Form values object
 * @returns Object with field names as keys and error messages as values
 */
export const validateForm = async <T extends Record<string, any>>(
  schema: yup.AnySchema,
  values: T
): Promise<Record<keyof T, string | undefined>> => {
  try {
    await schema.validate(values, { abortEarly: false });
    return {} as Record<keyof T, string | undefined>;
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      const errors: Record<string, string> = {};
      error.inner.forEach((err) => {
        if (err.path) {
          errors[err.path] = err.message;
        }
      });
      return errors as Record<keyof T, string | undefined>;
    }
    return {} as Record<keyof T, string | undefined>;
  }
};
