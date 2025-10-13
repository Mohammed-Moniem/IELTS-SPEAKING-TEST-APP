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

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { FormTextInput } from "../../components/FormTextInput";
import { ScreenContainer } from "../../components/ScreenContainer";
import { AuthStackParamList } from "../../navigation/AppNavigator";
import { colors, spacing } from "../../theme/tokens";

export type RegisterScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  "Register"
>;

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  navigation,
}) => {
  const { register } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      Alert.alert(
        "Missing details",
        "Please fill out email, password, first and last name."
      );
      return;
    }

    setLoading(true);
    try {
      await register({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
      });
    } catch (error: any) {
      Alert.alert(
        "Unable to register",
        error?.message || "Please review your information and try again."
      );
    } finally {
      setLoading(false);
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
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Track progress, receive AI feedback, and stay exam-ready.
          </Text>
        </View>

        <FormTextInput
          label="First name"
          value={form.firstName}
          onChangeText={(value) => updateField("firstName", value)}
        />
        <FormTextInput
          label="Last name"
          value={form.lastName}
          onChangeText={(value) => updateField("lastName", value)}
        />
        <FormTextInput
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(value) => updateField("email", value)}
          placeholder="you@example.com"
        />
        <FormTextInput
          label="Phone (optional)"
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={(value) => updateField("phone", value)}
          placeholder="+44 0000 000000"
        />
        <FormTextInput
          label="Password"
          secureTextEntry
          value={form.password}
          onChangeText={(value) => updateField("password", value)}
          placeholder="At least 8 characters"
        />

        <Button
          title="Create account"
          onPress={handleRegister}
          loading={loading}
        />

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.switchContainer}
        >
          <Text style={styles.switchText}>
            Already have an account? Sign in
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
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
