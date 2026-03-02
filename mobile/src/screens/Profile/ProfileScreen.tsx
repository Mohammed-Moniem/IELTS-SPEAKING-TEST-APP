import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ValidationError } from "yup";
import {
  preferencesApi,
  subscriptionApi,
  usageApi,
  userApi,
} from "../../api/services";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { FormTextInput } from "../../components/FormTextInput";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import {
  SubscriptionPlanOption,
  SubscriptionPlansModal,
} from "../../components/SubscriptionPlansModal";
import { Tag } from "../../components/Tag";
import { DEFAULT_SUBSCRIPTION_PLANS } from "../../constants/subscriptionPlans";
import { useTheme } from "../../context";
import { useProfile } from "../../hooks/useProfile";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { radii, spacing } from "../../theme/tokens";
import { formatDate } from "../../utils/date";
import { extractErrorMessage } from "../../utils/errors";
import { ProfileFormValues, profileSchema } from "../../utils/validation";

const BAND_SCORES = [
  "5.0",
  "5.5",
  "6.0",
  "6.5",
  "7.0",
  "7.5",
  "8.0",
  "8.5",
  "9.0",
];
const COUNTRIES = [
  "USA",
  "UK",
  "Canada",
  "Australia",
  "New Zealand",
  "Ireland",
  "Germany",
  "France",
  "Netherlands",
  "Sweden",
  "Other",
];

const COUNTRY_CODES = [
  // Middle East & North Africa
  { label: "🇦🇪 UAE (+971)", value: "+971", flag: "🇦🇪", code: "+971" },
  { label: "🇸🇦 Saudi Arabia (+966)", value: "+966", flag: "🇸🇦", code: "+966" },
  { label: "🇪🇬 Egypt (+20)", value: "+20", flag: "🇪🇬", code: "+20" },
  { label: "🇯🇴 Jordan (+962)", value: "+962", flag: "🇯🇴", code: "+962" },
  { label: "🇱🇧 Lebanon (+961)", value: "+961", flag: "🇱🇧", code: "+961" },
  { label: "🇰🇼 Kuwait (+965)", value: "+965", flag: "🇰🇼", code: "+965" },
  { label: "🇶🇦 Qatar (+974)", value: "+974", flag: "🇶🇦", code: "+974" },
  { label: "🇧🇭 Bahrain (+973)", value: "+973", flag: "🇧🇭", code: "+973" },
  { label: "🇴🇲 Oman (+968)", value: "+968", flag: "🇴🇲", code: "+968" },
  { label: "🇵🇸 Palestine (+970)", value: "+970", flag: "🇵🇸", code: "+970" },
  { label: "🇮🇶 Iraq (+964)", value: "+964", flag: "🇮🇶", code: "+964" },
  { label: "🇾🇪 Yemen (+967)", value: "+967", flag: "🇾🇪", code: "+967" },
  { label: "🇸🇾 Syria (+963)", value: "+963", flag: "🇸🇾", code: "+963" },
  { label: "🇲🇦 Morocco (+212)", value: "+212", flag: "🇲🇦", code: "+212" },
  { label: "🇹� Tunisia (+216)", value: "+216", flag: "🇹🇳", code: "+216" },
  { label: "🇩🇿 Algeria (+213)", value: "+213", flag: "🇩🇿", code: "+213" },
  { label: "🇱🇾 Libya (+218)", value: "+218", flag: "🇱🇾", code: "+218" },
  { label: "🇸🇩 Sudan (+249)", value: "+249", flag: "🇸🇩", code: "+249" },

  // English-speaking countries
  { label: "�🇺🇸 USA (+1)", value: "+1", flag: "🇺🇸", code: "+1" },
  { label: "🇬🇧 UK (+44)", value: "+44", flag: "🇬🇧", code: "+44" },
  { label: "🇨🇦 Canada (+1)", value: "+1", flag: "🇨🇦", code: "+1" },
  { label: "🇦🇺 Australia (+61)", value: "+61", flag: "🇦🇺", code: "+61" },
  { label: "🇳🇿 New Zealand (+64)", value: "+64", flag: "🇳🇿", code: "+64" },
  { label: "🇮🇪 Ireland (+353)", value: "+353", flag: "🇮🇪", code: "+353" },

  // Europe
  { label: "🇩🇪 Germany (+49)", value: "+49", flag: "🇩🇪", code: "+49" },
  { label: "🇫🇷 France (+33)", value: "+33", flag: "🇫🇷", code: "+33" },
  { label: "🇳🇱 Netherlands (+31)", value: "+31", flag: "🇳🇱", code: "+31" },
  { label: "🇸🇪 Sweden (+46)", value: "+46", flag: "🇸🇪", code: "+46" },
  { label: "🇪🇸 Spain (+34)", value: "+34", flag: "🇪🇸", code: "+34" },
  { label: "🇮� Italy (+39)", value: "+39", flag: "🇮🇹", code: "+39" },
  { label: "🇵🇱 Poland (+48)", value: "+48", flag: "🇵🇱", code: "+48" },
  { label: "🇨🇭 Switzerland (+41)", value: "+41", flag: "🇨🇭", code: "+41" },
  { label: "🇧🇪 Belgium (+32)", value: "+32", flag: "🇧🇪", code: "+32" },
  { label: "🇦🇹 Austria (+43)", value: "+43", flag: "🇦🇹", code: "+43" },
  { label: "🇩🇰 Denmark (+45)", value: "+45", flag: "🇩🇰", code: "+45" },
  { label: "🇳🇴 Norway (+47)", value: "+47", flag: "�🇳🇴", code: "+47" },
  { label: "🇫🇮 Finland (+358)", value: "+358", flag: "🇫🇮", code: "+358" },
  { label: "🇵🇹 Portugal (+351)", value: "+351", flag: "🇵🇹", code: "+351" },
  { label: "🇬🇷 Greece (+30)", value: "+30", flag: "🇬🇷", code: "+30" },
  { label: "🇷🇴 Romania (+40)", value: "+40", flag: "🇷🇴", code: "+40" },
  {
    label: "🇨🇿 Czech Republic (+420)",
    value: "+420",
    flag: "🇨🇿",
    code: "+420",
  },

  // Asia
  { label: "🇮🇳 India (+91)", value: "+91", flag: "🇮🇳", code: "+91" },
  { label: "🇵🇰 Pakistan (+92)", value: "+92", flag: "🇵🇰", code: "+92" },
  { label: "🇧🇩 Bangladesh (+880)", value: "+880", flag: "🇧🇩", code: "+880" },
  { label: "🇹🇷 Turkey (+90)", value: "+90", flag: "🇹🇷", code: "+90" },
  { label: "🇮🇩 Indonesia (+62)", value: "+62", flag: "🇮🇩", code: "+62" },
  { label: "🇲🇾 Malaysia (+60)", value: "+60", flag: "🇲🇾", code: "+60" },
  { label: "🇸🇬 Singapore (+65)", value: "+65", flag: "🇸🇬", code: "+65" },
  { label: "🇵🇭 Philippines (+63)", value: "+63", flag: "🇵🇭", code: "+63" },
  { label: "🇹🇭 Thailand (+66)", value: "+66", flag: "🇹🇭", code: "+66" },
  { label: "🇻🇳 Vietnam (+84)", value: "+84", flag: "🇻🇳", code: "+84" },
  { label: "🇰🇷 South Korea (+82)", value: "+82", flag: "🇰🇷", code: "+82" },
  { label: "🇯🇵 Japan (+81)", value: "+81", flag: "🇯🇵", code: "+81" },
  { label: "🇨🇳 China (+86)", value: "+86", flag: "🇨🇳", code: "+86" },
  { label: "🇭🇰 Hong Kong (+852)", value: "+852", flag: "🇭🇰", code: "+852" },
  { label: "🇹🇼 Taiwan (+886)", value: "+886", flag: "🇹🇼", code: "+886" },
  { label: "🇱🇰 Sri Lanka (+94)", value: "+94", flag: "🇱🇰", code: "+94" },
  { label: "🇳🇵 Nepal (+977)", value: "+977", flag: "🇳🇵", code: "+977" },
  { label: "🇦🇫 Afghanistan (+93)", value: "+93", flag: "🇦🇫", code: "+93" },
  { label: "🇮🇷 Iran (+98)", value: "+98", flag: "🇮🇷", code: "+98" },

  // Africa
  { label: "🇿🇦 South Africa (+27)", value: "+27", flag: "🇿🇦", code: "+27" },
  { label: "🇳🇬 Nigeria (+234)", value: "+234", flag: "🇳🇬", code: "+234" },
  { label: "🇰🇪 Kenya (+254)", value: "+254", flag: "🇰🇪", code: "+254" },
  { label: "🇪🇹 Ethiopia (+251)", value: "+251", flag: "🇪🇹", code: "+251" },
  { label: "🇬🇭 Ghana (+233)", value: "+233", flag: "🇬🇭", code: "+233" },

  // Americas
  { label: "🇲🇽 Mexico (+52)", value: "+52", flag: "🇲🇽", code: "+52" },
  { label: "🇧🇷 Brazil (+55)", value: "+55", flag: "🇧🇷", code: "+55" },
  { label: "🇦🇷 Argentina (+54)", value: "+54", flag: "🇦🇷", code: "+54" },
  { label: "🇨🇱 Chile (+56)", value: "+56", flag: "🇨🇱", code: "+56" },
  { label: "🇨🇴 Colombia (+57)", value: "+57", flag: "🇨🇴", code: "+57" },
  { label: "🇵🇪 Peru (+51)", value: "+51", flag: "🇵🇪", code: "+51" },
  { label: "🇻🇪 Venezuela (+58)", value: "+58", flag: "🇻🇪", code: "+58" },

  // Oceania
  { label: "🇫🇯 Fiji (+679)", value: "+679", flag: "🇫🇯", code: "+679" },
];

// Custom Dropdown Component
interface DropdownProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
}

const CustomDropdown: React.FC<DropdownProps> = ({
  label,
  value,
  options,
  onSelect,
}) => {
  const [visible, setVisible] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value);
  const dropdownStyles = useThemedStyles(createDropdownStyles);

  return (
    <>
      <TouchableOpacity
        style={dropdownStyles.container}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={dropdownStyles.selectedText}>
          {selectedOption?.label || label}
        </Text>
        <Text style={dropdownStyles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={dropdownStyles.modalOverlay}
          onPress={() => setVisible(false)}
        >
          <View style={dropdownStyles.modalContent}>
            <View style={dropdownStyles.modalHeader}>
              <Text style={dropdownStyles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={dropdownStyles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={dropdownStyles.optionsList}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    dropdownStyles.option,
                    option.value === value && dropdownStyles.selectedOption,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={[
                      dropdownStyles.optionText,
                      option.value === value &&
                        dropdownStyles.selectedOptionText,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.value === value && (
                    <Text style={dropdownStyles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const createDropdownStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.md,
      minHeight: 50,
    },
    selectedText: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "500",
      flex: 1,
    },
    arrow: {
      fontSize: 12,
      color: colors.textMuted,
      marginLeft: spacing.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlayBackdrop,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      width: "100%",
      maxWidth: 400,
      maxHeight: "70%",
      overflow: "hidden",
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
      backgroundColor: colors.surfaceSubtle,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    closeButton: {
      fontSize: 24,
      color: colors.textMuted,
      fontWeight: "300",
    },
    optionsList: {
      maxHeight: 400,
    },
    option: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    selectedOption: {
      backgroundColor: colors.primarySoft,
    },
    optionText: {
      fontSize: 16,
      color: colors.textPrimary,
      flex: 1,
    },
    selectedOptionText: {
      fontWeight: "600",
      color: colors.primary,
    },
    checkmark: {
      fontSize: 20,
      color: colors.primary,
      fontWeight: "700",
    },
  });

export const ProfileScreen: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const queryClient = useQueryClient();
  const {
    profile,
    loading: profileLoading,
    loadMyProfile,
    updateProfile: updateSocialProfile,
    updatePrivacySettings,
  } = useProfile();

  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: preferencesApi.get,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current"],
    queryFn: subscriptionApi.current,
  });

  const usageQuery = useQuery({
    queryKey: ["usage"],
    queryFn: usageApi.summary,
  });
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const countryCodeModalStyles = useThemedStyles(
    createCountryCodeModalStyles
  );

  // Helper function to parse phone number and extract country code
  const parsePhoneNumber = (phone: string) => {
    if (!phone) return { countryCode: "+971", phoneNumber: "" };

    // Check if phone starts with +
    if (phone.startsWith("+")) {
      // Find the country code
      const matchedCode = COUNTRY_CODES.find((cc) =>
        phone.startsWith(cc.value)
      );
      if (matchedCode) {
        return {
          countryCode: matchedCode.value,
          phoneNumber: phone.substring(matchedCode.value.length),
        };
      }
    }

    // Default to UAE if no country code found
    return { countryCode: "+971", phoneNumber: phone };
  };

  const parsedPhone = parsePhoneNumber(user?.phone ?? "");

  // Basic Profile State
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: parsedPhone.phoneNumber,
    username: profile?.username ?? "",
    bio: profile?.bio ?? "",
  });
  const [profileErrors, setProfileErrors] = useState<
    Partial<Record<keyof ProfileFormValues, string>>
  >({});

  const [countryCode, setCountryCode] = useState(parsedPhone.countryCode);
  const [showCountryCodePicker, setShowCountryCodePicker] = useState(false);

  // IELTS Info State
  const [ieltsType, setIeltsType] = useState<"academic" | "general">(
    profile?.ieltsInfo?.type ?? "academic"
  );
  const [targetBand, setTargetBand] = useState(
    profile?.ieltsInfo?.targetBand?.toString() ?? "7.0"
  );
  const [testDate, setTestDate] = useState<Date | undefined>(
    profile?.ieltsInfo?.testDate
      ? new Date(profile.ieltsInfo.testDate)
      : undefined
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Study Goals State
  const [studyPurpose, setStudyPurpose] = useState<string>(
    profile?.studyGoals?.purpose ?? "university"
  );
  const [targetCountry, setTargetCountry] = useState(
    profile?.studyGoals?.targetCountry ?? "UK"
  );

  // Social Settings State
  const [allowFriendSuggestions, setAllowFriendSuggestions] = useState(
    profile?.social?.allowFriendSuggestions ?? true
  );
  const [showOnlineStatus, setShowOnlineStatus] = useState(
    profile?.social?.showOnlineStatus ?? true
  );

  const handleProfileFieldChange = (
    key: keyof typeof profileForm,
    value: string
  ) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
    if (key === "firstName" || key === "lastName" || key === "phone") {
      setProfileErrors((prev) => ({
        ...prev,
        [key as keyof ProfileFormValues]: undefined,
      }));
    }
  };

  // Privacy Settings State
  const [profileVisibility, setProfileVisibility] = useState<
    "public" | "friends-only" | "private"
  >(profile?.privacy?.profileVisibility ?? "public");
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(
    profile?.privacy?.leaderboardOptIn ?? true
  );
  const [showStatistics, setShowStatistics] = useState(
    profile?.privacy?.showStatistics ?? true
  );

  // Load profile on mount
  useEffect(() => {
    loadMyProfile();
  }, []);

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        firstName: user?.firstName ?? "",
        lastName: user?.lastName ?? "",
        phone: user?.phone ?? "",
        username: profile.username ?? "",
        bio: profile.bio ?? "",
      });
      setIeltsType(profile.ieltsInfo?.type ?? "academic");
      setTargetBand(profile.ieltsInfo?.targetBand?.toString() ?? "7.0");
      setTestDate(
        profile.ieltsInfo?.testDate
          ? new Date(profile.ieltsInfo.testDate)
          : undefined
      );
      setStudyPurpose(profile.studyGoals?.purpose ?? "university");
      setTargetCountry(profile.studyGoals?.targetCountry ?? "UK");
      setAllowFriendSuggestions(profile.social?.allowFriendSuggestions ?? true);
      setShowOnlineStatus(profile.social?.showOnlineStatus ?? true);
      setProfileVisibility(profile.privacy?.profileVisibility ?? "public");
      setLeaderboardOptIn(profile.privacy?.leaderboardOptIn ?? true);
      setShowStatistics(profile.privacy?.showStatistics ?? true);
    }
  }, [profile, user]);

  useEffect(() => {
    const parsedPhone = parsePhoneNumber(user?.phone ?? "");
    setProfileForm({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: parsedPhone.phoneNumber,
      username: profile?.username ?? "",
      bio: profile?.bio ?? "",
    });
    setCountryCode(parsedPhone.countryCode);
  }, [
    user?.firstName,
    user?.lastName,
    user?.phone,
    profile?.username,
    profile?.bio,
  ]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    }) => userApi.updateProfile(payload),
    onSuccess: async () => {
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["preferences"] });
      Alert.alert("✓ Saved", "Your basic information has been updated.");
    },
    onError: (error) => {
      Alert.alert(
        "Update failed",
        extractErrorMessage(error, "Unable to update profile.")
      );
    },
  });

  const updateSocialProfileMutation = useMutation({
    mutationFn: async () => {
      // Validate username
      if (!profileForm.username || profileForm.username.trim().length < 3) {
        throw new Error("Username must be at least 3 characters long");
      }

      return await updateSocialProfile({
        username: profileForm.username.trim(),
        bio: profileForm.bio?.trim() || "",
        ieltsInfo: {
          type: ieltsType,
          targetBand: parseFloat(targetBand),
          testDate: testDate?.toISOString(),
        },
        studyGoals: {
          purpose: studyPurpose,
          targetCountry: targetCountry,
        },
        social: {
          allowFriendSuggestions,
          showOnlineStatus,
        },
      });
    },
    onSuccess: async () => {
      await loadMyProfile();
      Alert.alert(
        "✓ Saved",
        "Your profile has been updated! You can now be matched with friends."
      );
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to update social profile.";
      Alert.alert("Update failed", errorMessage);
    },
  });

  const updatePrivacyMutation = useMutation({
    mutationFn: async () => {
      return await updatePrivacySettings({
        profileVisibility,
        leaderboardOptIn,
        showStatistics,
      });
    },
    onSuccess: async () => {
      await loadMyProfile();
      Alert.alert("✓ Saved", "Your privacy settings have been updated.");
    },
    onError: (error) => {
      Alert.alert("Update failed", "Unable to update privacy settings.");
    },
  });

  const subscriptionConfigQuery = useQuery({
    queryKey: ["subscription-config"],
    queryFn: subscriptionApi.config,
  });

  const subscriptionPlanOptions = useMemo<SubscriptionPlanOption[]>(() => {
    const configPlans = subscriptionConfigQuery.data?.plans;
    if (configPlans?.length) {
      return configPlans.map((plan) => ({
        tier: plan.tier,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        description: plan.description,
        features: plan.features,
        limits: plan.limits,
      }));
    }
    return DEFAULT_SUBSCRIPTION_PLANS;
  }, [subscriptionConfigQuery.data]);

  const handleUpgrade = () => {
    if (!subscriptionConfigQuery.data?.enabled) {
      Alert.alert(
        "Payments unavailable",
        "Stripe integration is not enabled on this environment."
      );
      return;
    }
    setShowPlanSheet(true);
  };

  const handlePlanSelection = async (
    plan: SubscriptionPlanOption,
    options?: { couponCode?: string }
  ) => {
    if (plan.tier === "free") {
      Alert.alert(
        "Plan already active",
        "You are already on the Free plan. Manage downgrades from the billing portal."
      );
      return;
    }

    try {
      const response = await subscriptionApi.checkout({
        planType: plan.tier,
        couponCode: options?.couponCode,
      });
      setShowPlanSheet(false);
      if (response.checkoutUrl) {
        await WebBrowser.openBrowserAsync(response.checkoutUrl);
      } else {
        Alert.alert(
          "Checkout created",
          "Complete your upgrade from the web dashboard."
        );
      }
    } catch (error) {
      Alert.alert("Unable to start checkout", extractErrorMessage(error));
    }
  };

  const handleSaveBasicInfo = async () => {
    const trimmedValues: ProfileFormValues = {
      firstName: profileForm.firstName.trim(),
      lastName: profileForm.lastName.trim(),
      email: user?.email || "",
      phone: profileForm.phone.trim(),
    };

    try {
      await profileSchema.validate(trimmedValues, { abortEarly: false });
      setProfileErrors({});
    } catch (error) {
      if (error instanceof ValidationError) {
        const errors: Partial<Record<keyof ProfileFormValues, string>> = {};
        error.inner.forEach((err) => {
          if (err.path) {
            errors[err.path as keyof ProfileFormValues] = err.message;
          }
        });
        setProfileErrors(errors);
        Alert.alert(
          "Invalid details",
          "Please correct the highlighted fields."
        );
        return;
      }

      Alert.alert(
        "Invalid details",
        "Please review your information and try again."
      );
      return;
    }

    setProfileForm((prev) => ({
      ...prev,
      firstName: trimmedValues.firstName,
      lastName: trimmedValues.lastName,
      phone: trimmedValues.phone,
    }));

    let fullPhone = trimmedValues.phone;
    if (fullPhone) {
      if (!fullPhone.startsWith("+")) {
        fullPhone = `${countryCode}${fullPhone}`;
      }
    }

    updateProfileMutation.mutate({
      firstName: trimmedValues.firstName,
      lastName: trimmedValues.lastName,
      ...(fullPhone ? { phone: fullPhone } : {}),
    });
  };

  // Check if user already has premium/pro
  const isPremiumUser =
    user?.subscriptionPlan === "pro" ||
    user?.subscriptionPlan === "premium" ||
    usageQuery.data?.plan === "pro" ||
    subscriptionQuery.data?.planType === "premium" ||
    subscriptionQuery.data?.planType === "pro";

  return (
    <>
      <ScreenContainer scrollable>
      {/* Basic Information */}
      <View style={styles.card}>
        <SectionHeading title="Basic Information" />
        <FormTextInput
          label="First name"
          value={profileForm.firstName}
          onChangeText={(value) => handleProfileFieldChange("firstName", value)}
          errorMessage={profileErrors.firstName}
        />
        <FormTextInput
          label="Last name"
          value={profileForm.lastName}
          onChangeText={(value) => handleProfileFieldChange("lastName", value)}
          errorMessage={profileErrors.lastName}
        />
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.phoneContainer}>
          <TouchableOpacity
            style={styles.countryCodeButton}
            onPress={() => setShowCountryCodePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.countryCodeText}>
              {COUNTRY_CODES.find((c) => c.value === countryCode)?.flag || "🌐"}{" "}
              {countryCode}
            </Text>
            <Text style={styles.countryCodeArrow}>▼</Text>
          </TouchableOpacity>

          <View style={styles.phoneInputWrapper}>
            <TextInput
              value={profileForm.phone}
              onChangeText={(value) => handleProfileFieldChange("phone", value)}
              placeholder="543043329"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              style={styles.phoneInput}
            />
          </View>
        </View>
        {profileErrors.phone ? (
          <Text style={styles.errorText}>{profileErrors.phone}</Text>
        ) : null}

        {/* Country Code Picker Modal */}
        <Modal
          visible={showCountryCodePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCountryCodePicker(false)}
        >
          <Pressable
            style={countryCodeModalStyles.overlay}
            onPress={() => setShowCountryCodePicker(false)}
          >
            <View style={countryCodeModalStyles.content}>
              <View style={countryCodeModalStyles.header}>
                <Text style={countryCodeModalStyles.title}>
                  Select Country Code
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCountryCodePicker(false)}
                >
                  <Text style={countryCodeModalStyles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={countryCodeModalStyles.list}>
                {COUNTRY_CODES.map((country) => (
                  <TouchableOpacity
                    key={country.value + country.label}
                    style={[
                      countryCodeModalStyles.option,
                      country.value === countryCode &&
                        countryCodeModalStyles.selectedOption,
                    ]}
                    onPress={() => {
                      setCountryCode(country.value);
                      setShowCountryCodePicker(false);
                    }}
                  >
                    <Text style={countryCodeModalStyles.optionText}>
                      {country.label}
                    </Text>
                    {country.value === countryCode && (
                      <Text style={countryCodeModalStyles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        <View style={styles.buttonContainer}>
          <Button
            title="Save Basic Info"
            onPress={handleSaveBasicInfo}
            loading={updateProfileMutation.isPending}
          />
        </View>
      </View>

      {/* Social Profile */}
      <View style={styles.card}>
        <SectionHeading title="Social Profile" />
        <Text style={styles.helpText}>
          Complete your profile to connect with other IELTS learners
        </Text>

        <FormTextInput
          label="Username"
          value={profileForm.username}
          onChangeText={(value) =>
            setProfileForm((prev) => ({ ...prev, username: value }))
          }
          placeholder="Choose a unique username"
        />

        <FormTextInput
          label="Bio"
          value={profileForm.bio}
          onChangeText={(value) =>
            setProfileForm((prev) => ({ ...prev, bio: value }))
          }
          placeholder="Tell others about yourself"
          multiline
          numberOfLines={3}
        />

        {/* IELTS Information */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>IELTS Information</Text>
          <Text style={styles.helpText}>
            This helps us match you with similar learners
          </Text>

          <Text style={styles.label}>Test Type</Text>
          <CustomDropdown
            label="Select test type"
            value={ieltsType}
            options={[
              { label: "Academic", value: "academic" },
              { label: "General Training", value: "general" },
            ]}
            onSelect={(value) => setIeltsType(value as "academic" | "general")}
          />

          <Text style={styles.label}>Target Band Score</Text>
          <CustomDropdown
            label="Select target band"
            value={targetBand}
            options={BAND_SCORES.map((score) => ({
              label: score,
              value: score,
            }))}
            onSelect={setTargetBand}
          />

          <Text style={styles.label}>Test Date (Optional)</Text>
          {Platform.OS === "ios" ? (
            <DateTimePicker
              value={testDate ?? new Date()}
              mode="date"
              display="default"
              onChange={(_event: any, selectedDate?: Date) => {
                setTestDate(selectedDate);
              }}
              minimumDate={new Date()}
            />
          ) : (
            <>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {testDate ? formatDate(testDate) : "Select test date"}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={testDate ?? new Date()}
                  mode="date"
                  display="default"
                  onChange={(_event: any, selectedDate?: Date) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setTestDate(selectedDate);
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
            </>
          )}
        </View>

        {/* Study Goals */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Study Goals</Text>

          <Text style={styles.label}>Purpose</Text>
          <CustomDropdown
            label="Select study purpose"
            value={studyPurpose}
            options={[
              { label: "University Application", value: "university" },
              { label: "Immigration", value: "immigration" },
              { label: "Work Visa", value: "work" },
              { label: "Personal Development", value: "personal" },
            ]}
            onSelect={setStudyPurpose}
          />

          <Text style={styles.label}>Target Country</Text>
          <CustomDropdown
            label="Select target country"
            value={targetCountry}
            options={COUNTRIES.map((country) => ({
              label: country,
              value: country,
            }))}
            onSelect={setTargetCountry}
          />
        </View>

        {/* Social Settings */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Social Settings</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Allow Friend Suggestions</Text>
              <Text style={styles.settingDescription}>
                Let the app suggest friends based on your profile
              </Text>
            </View>
            <Switch
              value={allowFriendSuggestions}
              onValueChange={setAllowFriendSuggestions}
              trackColor={{ false: colors.borderMuted, true: colors.primary }}
              thumbColor={
                allowFriendSuggestions ? colors.surface : colors.surfaceSubtle
              }
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Show Online Status</Text>
              <Text style={styles.settingDescription}>
                Let friends see when you're online
              </Text>
            </View>
            <Switch
              value={showOnlineStatus}
              onValueChange={setShowOnlineStatus}
              trackColor={{ false: colors.borderMuted, true: colors.primary }}
              thumbColor={
                showOnlineStatus ? colors.surface : colors.surfaceSubtle
              }
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Save Social Profile"
            onPress={() => updateSocialProfileMutation.mutate()}
            loading={updateSocialProfileMutation.isPending}
          />
        </View>
      </View>

      {/* Privacy Settings */}
      <View style={styles.card}>
        <SectionHeading title="Privacy Settings" />

        <Text style={styles.label}>Profile Visibility</Text>
        <CustomDropdown
          label="Select visibility"
          value={profileVisibility}
          options={[
            { label: "Public (Anyone can find you)", value: "public" },
            {
              label: "Friends Only (Only friends can see)",
              value: "friends-only",
            },
            { label: "Private (Hidden from search)", value: "private" },
          ]}
          onSelect={(value) =>
            setProfileVisibility(value as "public" | "friends-only" | "private")
          }
        />

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingLabel}>Show on Leaderboard</Text>
            <Text style={styles.settingDescription}>
              Appear on global and friends leaderboards
            </Text>
          </View>
          <Switch
            value={leaderboardOptIn}
            onValueChange={setLeaderboardOptIn}
            trackColor={{ false: colors.borderMuted, true: colors.primary }}
            thumbColor={
              leaderboardOptIn ? colors.surface : colors.surfaceSubtle
            }
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingLabel}>Show Statistics</Text>
            <Text style={styles.settingDescription}>
              Let others see your practice stats
            </Text>
          </View>
          <Switch
            value={showStatistics}
            onValueChange={setShowStatistics}
            trackColor={{ false: colors.borderMuted, true: colors.primary }}
            thumbColor={showStatistics ? colors.surface : colors.surfaceSubtle}
          />
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Save Privacy Settings"
            onPress={() => updatePrivacyMutation.mutate()}
            loading={updatePrivacyMutation.isPending}
          />
        </View>
      </View>

      {/* Subscription */}
      <View style={styles.card}>
        <SectionHeading title="Subscription" />
        {subscriptionQuery.data ? (
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <Tag label={subscriptionQuery.data.planType.toUpperCase()} />
              {usageQuery.data?.plan && (
                <Text style={styles.usagePlan}>
                  Usage: {usageQuery.data.plan.toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.subscriptionStatus}>
              Status:{" "}
              <Text style={styles.bold}>{subscriptionQuery.data.status}</Text>
            </Text>
            <Text style={styles.subscriptionMeta}>
              {subscriptionQuery.data.metadata?.label} plan{" "}
              {subscriptionQuery.data.isTrialActive
                ? `trial ends ${formatDate(subscriptionQuery.data.trialEndsAt)}`
                : `since ${formatDate(
                    subscriptionQuery.data.subscriptionDate
                  )}`}
            </Text>
            {isPremiumUser ? (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>
                  ✨ You have Premium access
                </Text>
              </View>
            ) : (
              <View style={styles.buttonContainer}>
                <Button title="Upgrade to Premium" onPress={handleUpgrade} />
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* Sign Out */}
      <View style={styles.card}>
        <Button title="Sign out" variant="ghost" onPress={() => logout()} />
      </View>
      </ScreenContainer>

      <SubscriptionPlansModal
        visible={showPlanSheet}
        plans={subscriptionPlanOptions}
        currentTier={subscriptionQuery.data?.planType ?? "free"}
        loading={subscriptionConfigQuery.isLoading}
        onClose={() => setShowPlanSheet(false)}
        onSelectPlan={handlePlanSelection}
      />
    </>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonContainer: {
    marginTop: spacing.lg,
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  subsection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  helpText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  errorText: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: 13,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  settingText: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  subscriptionCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surfaceSubtle,
  },
  subscriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  usagePlan: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  subscriptionStatus: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
  },
  bold: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  subscriptionMeta: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textMuted,
  },
  premiumBadge: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary + "15",
    borderRadius: radii.md,
    alignItems: "center",
  },
  premiumText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  countryCodeButton: {
    height: 56,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: spacing.sm,
    width: 135,
  },
  countryCodeText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  countryCodeArrow: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  phoneInputWrapper: {
    flex: 1,
    height: 56,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  phoneInput: {
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
  },
  });

const createCountryCodeModalStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlayBackdrop,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    content: {
      width: "100%",
      maxHeight: "80%",
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
      backgroundColor: colors.surfaceSubtle,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    closeButton: {
      fontSize: 24,
      color: colors.textMuted,
      fontWeight: "300",
    },
    list: {
      maxHeight: 400,
    },
    option: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    selectedOption: {
      backgroundColor: colors.primary + "10",
    },
    optionText: {
      fontSize: 15,
      color: colors.textPrimary,
    },
    checkmark: {
      fontSize: 18,
      color: colors.primary,
      fontWeight: "600",
    },
  });
