import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { colors, radii, spacing } from "../theme/tokens";

interface FormTextInputProps extends TextInputProps {
  label: string;
  errorMessage?: string;
}

export const FormTextInput: React.FC<FormTextInputProps> = ({
  label,
  errorMessage,
  style,
  ...props
}) => (
  <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, style, errorMessage ? styles.inputError : null]}
      placeholderTextColor={colors.textMuted}
      {...props}
    />
    {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    marginTop: spacing.xs,
    color: colors.danger,
  },
});
