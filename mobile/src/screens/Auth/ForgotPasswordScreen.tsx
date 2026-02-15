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
import { ScreenContainer } from "../../components/ScreenContainer";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { AuthStackParamList } from "../../navigation/AppNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { extractErrorMessage } from "../../utils/errors";
import {
  ForgotPasswordFormValues,
  forgotPasswordSchema,
} from "../../utils/validation";

export type ForgotPasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  "ForgotPassword"
>;

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  const { requestPasswordReset } = useAuth();
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const initialValues: ForgotPasswordFormValues = {
    email: "",
  };

  const handleSubmit = async (
    values: ForgotPasswordFormValues,
    helpers: FormikHelpers<ForgotPasswordFormValues>
  ) => {
    setLoading(true);
    try {
      await requestPasswordReset(values.email.trim().toLowerCase());
      Alert.alert(
        "Check your email",
        "If that email exists, you'll receive a password reset link shortly."
      );
      navigation.navigate("Login");
    } catch (error) {
      Alert.alert("Unable to request reset", extractErrorMessage(error));
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
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we’ll send a reset link. If you don’t see it,
            check spam/junk.
          </Text>
        </View>

        <Formik<ForgotPasswordFormValues>
          initialValues={initialValues}
          validationSchema={forgotPasswordSchema}
          onSubmit={handleSubmit}
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

              <Button
                title="Send reset link"
                onPress={() => handleSubmit()}
                loading={loading || isSubmitting}
                disabled={isSubmitting || (!isValid && touched.email)}
              />
            </View>
          )}
        </Formik>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.switchContainer}
        >
          <Text style={styles.switchText}>Back to sign in</Text>
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

