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

export type LoginScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  "Login"
>;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing details", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error: any) {
      Alert.alert(
        "Unable to sign in",
        error?.message || "Please check your credentials and try again."
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to track your IELTS speaking practice and feedback.
          </Text>
        </View>

        <FormTextInput
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />

        <FormTextInput
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="********"
        />

        <Button title="Sign in" onPress={handleLogin} loading={loading} />

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
