import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
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
import { Card } from "../../components/Card";
import { FormTextInput } from "../../components/FormTextInput";
import { ScreenContainer } from "../../components/ScreenContainer";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { AppStackParamList } from "../../navigation/AppNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { extractErrorMessage } from "../../utils/errors";
import { UpgradeGuestFormValues, upgradeGuestSchema } from "../../utils/validation";

export type UpgradeAccountScreenProps = NativeStackScreenProps<
  AppStackParamList,
  "UpgradeAccount"
>;

export const UpgradeAccountScreen: React.FC<UpgradeAccountScreenProps> = ({
  navigation,
}) => {
  const { user, upgradeGuest, continueWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [showOptional, setShowOptional] = useState(false);

  const initialValues: UpgradeGuestFormValues = useMemo(
    () => ({
      email: "",
      password: "",
      confirmPassword: "",
      firstName: user?.firstName && user.firstName !== "Guest" ? user.firstName : "",
      lastName: user?.lastName && user.lastName !== "User" ? user.lastName : "",
      phone: user?.phone ?? "",
      referralCode: "",
    }),
    [user?.firstName, user?.lastName, user?.phone]
  );

  const handleSubmit = async (
    values: UpgradeGuestFormValues,
    helpers: FormikHelpers<UpgradeGuestFormValues>
  ) => {
    setLoading(true);
    try {
      await upgradeGuest({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        firstName: values.firstName?.trim() || undefined,
        lastName: values.lastName?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        referralCode: values.referralCode
          ? values.referralCode.trim().toUpperCase()
          : undefined,
      });
      Alert.alert("Account created", "Your guest session has been upgraded.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Unable to create account", extractErrorMessage(error));
    } finally {
      setLoading(false);
      helpers.setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      await continueWithGoogle();
      Alert.alert("Account upgraded", "Your guest session is now linked to Google.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Unable to continue", extractErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ width: "100%" }}
        keyboardVerticalOffset={80}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create your Spokio account</Text>
          <Text style={styles.subtitle}>
            Keep your history and unlock Social and Analytics.
          </Text>
        </View>

        <Button
          title="Continue with Google"
          variant="ghost"
          onPress={handleGoogle}
          loading={googleLoading}
          disabled={loading}
        />

        <Card>
          <Formik<UpgradeGuestFormValues>
            initialValues={initialValues}
            validationSchema={upgradeGuestSchema}
            onSubmit={handleSubmit}
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
            }) => (
              <View>
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

                <FormTextInput
                  label="Confirm password"
                  secureTextEntry
                  value={values.confirmPassword}
                  onChangeText={handleChange("confirmPassword")}
                  onBlur={handleBlur("confirmPassword")}
                  placeholder="Re-enter your password"
                  errorMessage={
                    touched.confirmPassword ? errors.confirmPassword : undefined
                  }
                />

                <TouchableOpacity
                  onPress={() => setShowOptional((v) => !v)}
                  style={styles.optionalToggle}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionalToggleText}>
                    {showOptional ? "Hide optional details" : "Add optional details"}
                  </Text>
                </TouchableOpacity>

                {showOptional ? (
                  <View style={styles.optionalSection}>
                    <FormTextInput
                      label="First name (optional)"
                      value={values.firstName || ""}
                      onChangeText={handleChange("firstName")}
                      onBlur={handleBlur("firstName")}
                      errorMessage={touched.firstName ? (errors as any).firstName : undefined}
                    />
                    <FormTextInput
                      label="Last name (optional)"
                      value={values.lastName || ""}
                      onChangeText={handleChange("lastName")}
                      onBlur={handleBlur("lastName")}
                      errorMessage={touched.lastName ? (errors as any).lastName : undefined}
                    />
                    <FormTextInput
                      label="Phone (optional)"
                      keyboardType="phone-pad"
                      value={values.phone || ""}
                      onChangeText={handleChange("phone")}
                      onBlur={handleBlur("phone")}
                      placeholder="+44 0000 000000"
                      errorMessage={touched.phone ? errors.phone : undefined}
                    />
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
                      errorMessage={touched.referralCode ? errors.referralCode : undefined}
                    />
                  </View>
                ) : null}

                <Button
                  title="Create account"
                  onPress={() => handleSubmit()}
                  loading={loading || isSubmitting}
                  disabled={
                    isSubmitting ||
                    ((touched.email ||
                      touched.password ||
                      touched.confirmPassword ||
                      touched.firstName ||
                      touched.lastName ||
                      touched.phone ||
                      touched.referralCode) &&
                      !isValid)
                  }
                />

                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.cancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Not now</Text>
                </TouchableOpacity>
              </View>
            )}
          </Formik>
        </Card>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: "center",
      paddingBottom: spacing.xxl,
    },
    header: {
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    optionalToggle: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      alignItems: "center",
    },
    optionalToggleText: {
      color: colors.primary,
      fontWeight: "600",
    },
    optionalSection: {
      marginTop: spacing.sm,
    },
    cancel: {
      marginTop: spacing.md,
      alignItems: "center",
    },
    cancelText: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
  });
