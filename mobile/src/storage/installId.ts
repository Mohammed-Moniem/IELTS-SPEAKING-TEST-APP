import AsyncStorage from "@react-native-async-storage/async-storage";

const INSTALL_ID_KEY = "spokio_install_id";

const generateInstallId = () => {
  const rand = () => Math.random().toString(36).slice(2);
  return `install_${Date.now()}_${rand()}${rand()}`;
};

export const getOrCreateInstallId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  const created = generateInstallId();
  await AsyncStorage.setItem(INSTALL_ID_KEY, created);
  return created;
};

