import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { preferencesApi, subscriptionApi, userApi } from "../../api/services";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { FormTextInput } from "../../components/FormTextInput";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { Tag } from "../../components/Tag";
import { colors, radii, spacing } from "../../theme/tokens";
import { formatDate } from "../../utils/date";
import { extractErrorMessage } from "../../utils/errors";

export const ProfileScreen: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: preferencesApi.get,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current"],
    queryFn: subscriptionApi.current,
  });

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
  });

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
    });
  }, [user?.firstName, user?.lastName, user?.phone]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    }) => userApi.updateProfile(payload),
    onSuccess: async () => {
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["preferences"] });
      Alert.alert(
        "Profile updated",
        "Your profile information has been saved."
      );
    },
    onError: (error) => {
      Alert.alert(
        "Update failed",
        extractErrorMessage(error, "Unable to update profile.")
      );
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (payload: {
      testDate?: string;
      targetBand?: string;
      timeFrame?: string;
    }) => preferencesApi.upsert(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["preferences"] });
      Alert.alert("Preferences saved", "Updated your exam preferences.");
    },
    onError: (error) => {
      Alert.alert("Unable to save", extractErrorMessage(error));
    },
  });

  const subscriptionConfigQuery = useQuery({
    queryKey: ["subscription-config"],
    queryFn: subscriptionApi.config,
  });

  const handleUpgrade = async () => {
    if (!subscriptionConfigQuery.data?.enabled) {
      Alert.alert(
        "Payments unavailable",
        "Stripe integration is not enabled on this environment."
      );
      return;
    }

    try {
      const response = await subscriptionApi.checkout({ planType: "premium" });
      if (response.checkoutUrl) {
        await WebBrowser.openBrowserAsync(response.checkoutUrl);
      } else {
        Alert.alert("Checkout created", "Use web app to complete payment.");
      }
    } catch (error) {
      Alert.alert("Unable to start checkout", extractErrorMessage(error));
    }
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.section}>
        <SectionHeading title="Profile Information" />
        <FormTextInput
          label="First name"
          value={profileForm.firstName}
          onChangeText={(value) =>
            setProfileForm((prev) => ({ ...prev, firstName: value }))
          }
        />
        <FormTextInput
          label="Last name"
          value={profileForm.lastName}
          onChangeText={(value) =>
            setProfileForm((prev) => ({ ...prev, lastName: value }))
          }
        />
        <FormTextInput
          label="Phone"
          value={profileForm.phone}
          onChangeText={(value) =>
            setProfileForm((prev) => ({ ...prev, phone: value }))
          }
        />
        <Button
          title="Save profile"
          onPress={() => updateProfileMutation.mutate(profileForm)}
          loading={updateProfileMutation.isPending}
        />
        <Button title="Sign out" variant="ghost" onPress={() => logout()} />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Exam preferences" />
        <FormTextInput
          label="Target band"
          value={preferencesQuery.data?.targetBand ?? ""}
          onChangeText={(value) =>
            updatePreferencesMutation.mutate({ targetBand: value })
          }
          placeholder="e.g. 7.5"
        />
        <FormTextInput
          label="Timeframe"
          value={preferencesQuery.data?.timeFrame ?? ""}
          onChangeText={(value) =>
            updatePreferencesMutation.mutate({ timeFrame: value })
          }
          placeholder="3 months"
        />
        <FormTextInput
          label="Test date"
          value={
            preferencesQuery.data?.testDate
              ? preferencesQuery.data.testDate.split("T")[0]
              : ""
          }
          onChangeText={(value) =>
            updatePreferencesMutation.mutate({ testDate: value })
          }
          placeholder="2024-09-01"
        />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Subscription" />
        {subscriptionQuery.data ? (
          <View style={styles.subscriptionCard}>
            <Tag label={subscriptionQuery.data.planType.toUpperCase()} />
            <Text style={styles.subscriptionText}>
              Status: {subscriptionQuery.data.status}
            </Text>
            <Text style={styles.subscriptionMeta}>
              {subscriptionQuery.data.metadata?.label} plan{" "}
              {subscriptionQuery.data.isTrialActive
                ? `trial ends ${formatDate(subscriptionQuery.data.trialEndsAt)}`
                : `since ${formatDate(
                    subscriptionQuery.data.subscriptionDate
                  )}`}
            </Text>
            <Button title="Upgrade to Premium" onPress={handleUpgrade} />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  subscriptionCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surfaceSubtle,
  },
  subscriptionText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  subscriptionMeta: {
    marginTop: spacing.xs,
    color: colors.textMuted,
  },
});
