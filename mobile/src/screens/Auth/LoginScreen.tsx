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
import { AuthStackParamList } from "../../navigation/AppNavigator";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { LoginFormValues, loginSchema } from "../../utils/validation";

export type LoginScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  "Login"
>;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const initialValues: LoginFormValues = {
    email: "",
    password: "",
  };

  const handleLogin = async (
    values: LoginFormValues,
    { setSubmitting }: FormikHelpers<LoginFormValues>
  ) => {
    setLoading(true);
    try {
      await login(values.email.trim().toLowerCase(), values.password);
    } catch (error: any) {
      Alert.alert(
        "Unable to sign in",
        error?.message || "Please check your credentials and try again."
      );
    } finally {
      setLoading(false);
      setSubmitting(false);
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to track your IELTS speaking practice and feedback.
          </Text>
        </View>

        <Formik<LoginFormValues>
          initialValues={initialValues}
          validationSchema={loginSchema}
          onSubmit={handleLogin}
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

              <FormTextInput
                label="Password"
                secureTextEntry
                value={values.password}
                onChangeText={handleChange("password")}
                onBlur={handleBlur("password")}
                placeholder="********"
                errorMessage={touched.password ? errors.password : undefined}
              />

              <Button
                title="Sign in"
                onPress={() => handleSubmit()}
                loading={loading || isSubmitting}
                disabled={
                  isSubmitting ||
                  (!isValid && (touched.email || touched.password))
                }
              />
              <View style={styles.trustRow}>
                <Text style={styles.trustText}>Secure login</Text>
                <Text style={styles.trustDot}>•</Text>
                <Text style={styles.trustText}>Your data stays private</Text>
              </View>
            </View>
          )}
        </Formik>

        <TouchableOpacity
          onPress={() => navigation.navigate("Register")}
          style={styles.switchContainer}
        >
          <Text style={styles.switchText}>New here? Create an account</Text>
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
  trustRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  trustText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  trustDot: {
    fontSize: 12,
    color: colors.textMuted,
  },
  });
