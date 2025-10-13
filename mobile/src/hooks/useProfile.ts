import { useCallback, useState } from "react";
import profileService, {
  UserProfile,
  UserStatistics,
} from "../services/api/profileService";

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMyProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileService.getMyProfile();
      setProfile(data);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load profile");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileService.getUserProfile(userId);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load user profile");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: any) => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileService.updateProfile(updates);
      setProfile(data);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update profile");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePrivacySettings = useCallback(async (privacySettings: any) => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileService.updatePrivacySettings(privacySettings);
      setProfile(data);
      return true;
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to update privacy settings"
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStatistics = useCallback(async (userId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileService.getUserStatistics(userId);
      setStatistics(data);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load statistics");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateQRCode = useCallback(async (): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileService.generateQRCode();
      return data.qrCode;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to generate QR code");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    profile,
    statistics,
    loading,
    error,
    loadMyProfile,
    loadUserProfile,
    updateProfile,
    updatePrivacySettings,
    loadStatistics,
    generateQRCode,
  };
};
