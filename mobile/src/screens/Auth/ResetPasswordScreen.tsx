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
import { ScreenContainer } from "../../components/ScreenContainer";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { extractErrorMessage } from "../../utils/errors";
import {
  PasswordResetConfirmFormValues,
  passwordResetConfirmSchema,
} from "../../utils/validation";

export const ResetPasswordScreen: React.FC<any> = ({ navigation }) => {
  const { confirmPasswordReset } = useAuth();
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const initialValues: PasswordResetConfirmFormValues = {
    newPassword: "",
    confirmNewPassword: "",
  };

  const handleSubmit = async (
    values: PasswordResetConfirmFormValues,
    helpers: FormikHelpers<PasswordResetConfirmFormValues>
  ) => {
    setLoading(true);
    try {
      await confirmPasswordReset("", values.newPassword);
      Alert.alert("Password updated", "Your password has been updated.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Unable to reset password", extractErrorMessage(error));
    } finally {
      setLoading(false);
      helpers.setSubmitting(false);
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
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your account.
          </Text>
        </View>

        <Formik<PasswordResetConfirmFormValues>
          initialValues={initialValues}
          validationSchema={passwordResetConfirmSchema}
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
          }) => (
            <View>
              <FormTextInput
                label="New password"
                secureTextEntry
                value={values.newPassword}
                onChangeText={handleChange("newPassword")}
                onBlur={handleBlur("newPassword")}
                placeholder="At least 8 characters"
                errorMessage={touched.newPassword ? errors.newPassword : undefined}
              />

              <FormTextInput
                label="Confirm new password"
                secureTextEntry
                value={values.confirmNewPassword}
                onChangeText={handleChange("confirmNewPassword")}
                onBlur={handleBlur("confirmNewPassword")}
                placeholder="Re-enter your password"
                errorMessage={
                  touched.confirmNewPassword ? errors.confirmNewPassword : undefined
                }
              />

              <Button
                title="Update password"
                onPress={() => handleSubmit()}
                loading={loading || isSubmitting}
                disabled={
                  isSubmitting ||
                  (!isValid &&
                    (touched.newPassword || touched.confirmNewPassword))
                }
              />
            </View>
          )}
        </Formik>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.switchContainer}
        >
          <Text style={styles.switchText}>Back</Text>
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
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    switchContainer: {
      marginTop: spacing.xl,
      alignItems: "center",
    },
    switchText: {
      color: colors.primary,
      fontWeight: "600",
    },
  });
