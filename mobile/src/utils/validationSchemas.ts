import * as Yup from "yup";

/**
 * Validation schema for login form
 */
export const loginValidationSchema = Yup.object().shape({
  email: Yup.string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .lowercase()
    .trim(),
  password: Yup.string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters"),
});

/**
 * Validation schema for registration form
 */
export const registerValidationSchema = Yup.object().shape({
  name: Yup.string()
    .required("Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces")
    .trim(),
  email: Yup.string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .lowercase()
    .trim(),
  password: Yup.string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      "Password must include upper, lower, number, and a special character (!@#$%^&*)"
    ),
  confirmPassword: Yup.string()
    .required("Please confirm your password")
    .oneOf([Yup.ref("password")], "Passwords must match"),
  referralCode: Yup.string()
    .trim()
    .uppercase()
    .matches(/^[A-Z0-9]{4,20}$/, {
      message: "Referral code must be 4-20 characters (letters or numbers)",
      excludeEmptyString: true,
    })
    .notRequired()
    .default(""),
});

/**
 * Validation schema for profile update form
 */
export const profileValidationSchema = Yup.object().shape({
  name: Yup.string()
    .required("Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces")
    .trim(),
  email: Yup.string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .lowercase()
    .trim(),
  bio: Yup.string()
    .max(500, "Bio must not exceed 500 characters")
    .trim()
    .nullable(),
  targetBand: Yup.number()
    .min(1, "Target band must be between 1 and 9")
    .max(9, "Target band must be between 1 and 9")
    .nullable(),
});

/**
 * Validation schema for password change form
 */
export const changePasswordValidationSchema = Yup.object().shape({
  currentPassword: Yup.string()
    .required("Current password is required")
    .min(6, "Password must be at least 6 characters"),
  newPassword: Yup.string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      "Password must include upper, lower, number, and a special character (!@#$%^&*)"
    )
    .notOneOf(
      [Yup.ref("currentPassword")],
      "New password must be different from current password"
    ),
  confirmNewPassword: Yup.string()
    .required("Please confirm your new password")
    .oneOf([Yup.ref("newPassword")], "Passwords must match"),
});

/**
 * Validation schema for forgot password form
 */
export const forgotPasswordValidationSchema = Yup.object().shape({
  email: Yup.string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .lowercase()
    .trim(),
});

/**
 * Validation schema for reset password form
 */
export const resetPasswordValidationSchema = Yup.object().shape({
  code: Yup.string()
    .required("Verification code is required")
    .length(6, "Verification code must be 6 digits")
    .matches(/^\d+$/, "Verification code must contain only numbers"),
  newPassword: Yup.string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
      "Password must include upper, lower, number, and a special character (!@#$%^&*)"
    ),
  confirmNewPassword: Yup.string()
    .required("Please confirm your new password")
    .oneOf([Yup.ref("newPassword")], "Passwords must match"),
});

/**
 * Validation schema for feedback/contact form
 */
export const feedbackValidationSchema = Yup.object().shape({
  subject: Yup.string()
    .required("Subject is required")
    .min(5, "Subject must be at least 5 characters")
    .max(100, "Subject must not exceed 100 characters")
    .trim(),
  message: Yup.string()
    .required("Message is required")
    .min(20, "Message must be at least 20 characters")
    .max(1000, "Message must not exceed 1000 characters")
    .trim(),
  email: Yup.string()
    .email("Please enter a valid email address")
    .lowercase()
    .trim()
    .nullable(),
});

/**
 * Validation schema for referral code input
 */
export const referralCodeValidationSchema = Yup.object().shape({
  referralCode: Yup.string()
    .required("Referral code is required")
    .min(4, "Referral code must be at least 4 characters")
    .max(20, "Referral code must not exceed 20 characters")
    .matches(
      /^[A-Z0-9]+$/,
      "Referral code can only contain uppercase letters and numbers"
    )
    .trim(),
});
