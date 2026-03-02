import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Formik, FormikHelpers } from "formik";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { FormTextInput } from "../../components/FormTextInput";
import { PasswordStrengthIndicator } from "../../components/PasswordStrengthIndicator";
import { ScreenContainer } from "../../components/ScreenContainer";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import { AuthStackParamList } from "../../navigation/AppNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { RegisterFormValues, registerSchema } from "../../utils/validation";

export type RegisterScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  "Register"
>;

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  navigation,
  route,
}) => {
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<1 | 2>(1);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const referralCodeParam = route.params?.referralCode ?? "";
  const [showReferralField, setShowReferralField] = useState(
    Boolean(referralCodeParam)
  );

  const initialValues: RegisterFormValues = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    referralCode: referralCodeParam,
  };

  const handleRegister = async (
    values: RegisterFormValues,
    { setSubmitting }: FormikHelpers<RegisterFormValues>
  ) => {
    setLoading(true);
    try {
      await register({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone?.trim() || undefined,
        referralCode: values.referralCode
          ? values.referralCode.trim().toUpperCase()
          : undefined,
      });
    } catch (error: any) {
      Alert.alert(
        "Unable to register",
        error?.message || "Please review your information and try again."
      );
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer
      scrollable
      bounces={false}
      contentContainerStyle={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ width: "100%" }}
        keyboardVerticalOffset={80}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Track progress, receive AI feedback, and stay exam-ready.
          </Text>
        </View>

        <Formik<RegisterFormValues>
          initialValues={initialValues}
          validationSchema={registerSchema}
          onSubmit={handleRegister}
          enableReinitialize
        >
          {({
            handleChange,
            handleBlur,
            handleSubmit,
            values,
            errors,
            touched,
            isSubmitting,
            isValid,
            setFieldValue,
            validateForm,
            setFieldTouched,
          }) => (
            <View>
              {stage === 1 ? (
                <>
                  <FormTextInput
                    label="First name"
                    value={values.firstName}
                    onChangeText={handleChange("firstName")}
                    onBlur={handleBlur("firstName")}
                    errorMessage={
                      touched.firstName ? errors.firstName : undefined
                    }
                  />
                  <FormTextInput
                    label="Last name"
                    value={values.lastName}
                    onChangeText={handleChange("lastName")}
                    onBlur={handleBlur("lastName")}
                    errorMessage={touched.lastName ? errors.lastName : undefined}
                  />
                  <FormTextInput
                    label="Email"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={values.email}
                    onChangeText={handleChange("email")}
                    onBlur={handleBlur("email")}
                    placeholder="you@example.com"
                    errorMessage={touched.email ? errors.email : undefined}
                  />
                  <FormTextInput
                    label="Password"
                    secureTextEntry
                    value={values.password}
                    onChangeText={handleChange("password")}
                    onBlur={handleBlur("password")}
                    placeholder="At least 8 characters"
                    errorMessage={touched.password ? errors.password : undefined}
                  />

                  <Text style={styles.passwordHint}>
                    Use upper & lower case letters, a number, and one special
                    character (!@#$%^&*).
                  </Text>
                  <PasswordStrengthIndicator password={values.password} />

                  <FormTextInput
                    label="Confirm password"
                    secureTextEntry
                    value={values.confirmPassword}
                    onChangeText={handleChange("confirmPassword")}
                    onBlur={handleBlur("confirmPassword")}
                    placeholder="Re-enter your password"
                    errorMessage={
                      touched.confirmPassword
                        ? errors.confirmPassword
                        : undefined
                    }
                  />

                  <Button
                    title="Continue"
                    onPress={async () => {
                      const validationErrors = await validateForm();
                      const requiredFields: Array<keyof RegisterFormValues> = [
                        "firstName",
                        "lastName",
                        "email",
                        "password",
                        "confirmPassword",
                      ];

                      await Promise.all(
                        requiredFields.map((field) =>
                          setFieldTouched(field, true, true)
                        )
                      );

                      const hasRequiredErrors = requiredFields.some(
                        (field) => Boolean((validationErrors as any)[field])
                      );

                      if (!hasRequiredErrors) {
                        setStage(2);
                      }
                    }}
                    disabled={isSubmitting || loading}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Optional details</Text>
                  <FormTextInput
                    label="Phone (optional)"
                    keyboardType="phone-pad"
                    value={values.phone || ""}
                    onChangeText={handleChange("phone")}
                    onBlur={handleBlur("phone")}
                    placeholder="+44 0000 000000"
                    errorMessage={touched.phone ? errors.phone : undefined}
                  />

                  {!showReferralField ? (
                    <TouchableOpacity
                      style={styles.referralToggle}
                      onPress={() => setShowReferralField(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Add referral code"
                      accessibilityHint="Expand optional referral code input"
                    >
                      <Text style={styles.referralToggleText}>
                        Have a referral code?
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <FormTextInput
                      label="Referral code (optional)"
                      autoCapitalize="characters"
                      maxLength={20}
                      value={values.referralCode || ""}
                      onChangeText={(text) =>
                        setFieldValue("referralCode", text.toUpperCase())
                      }
                      onBlur={handleBlur("referralCode")}
                      placeholder="Enter code if you have one"
                      errorMessage={
                        touched.referralCode ? errors.referralCode : undefined
                      }
                    />
                  )}

                  <View style={styles.ctaTrustRow}>
                    <Text style={styles.ctaTrustText}>No card required</Text>
                    <Text style={styles.ctaTrustDot}>•</Text>
                    <Text style={styles.ctaTrustText}>Private by default</Text>
                  </View>

                  <Button
                    title="Create account"
                    onPress={() => handleSubmit()}
                    loading={loading || isSubmitting}
                    disabled={isSubmitting || !isValid}
                  />
                  <TouchableOpacity
                    onPress={() => setStage(1)}
                    style={styles.backToBasics}
                    accessibilityRole="button"
                    accessibilityLabel="Edit basic details"
                    accessibilityHint="Return to the first step of registration"
                  >
                    <Text style={styles.backToBasicsText}>
                      Edit basic details
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </Formik>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.switchContainer}
          accessibilityRole="button"
          accessibilityLabel="Go to sign in"
          accessibilityHint="Return to the login screen"
        >
          <Text style={styles.switchText}>
            Already have an account? Sign in
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
  },
  header: {
    marginBottom: spacing.xl + spacing.sm,
    marginTop: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  passwordHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  switchContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  switchText: {
    color: colors.primary,
    fontWeight: "600",
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  referralToggle: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  referralToggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  ctaTrustRow: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  ctaTrustText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  ctaTrustDot: {
    fontSize: 12,
    color: colors.textMuted,
  },
  backToBasics: {
    alignItems: "center",
    marginTop: spacing.xs,
  },
  backToBasicsText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  });
