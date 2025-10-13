// API Configuration
// Using ngrok tunnel for development to work from anywhere
// ⚠️ This URL is auto-generated on each restart by start-dev-multi-terminal.sh
export const API_BASE_URL = __DEV__
  ? "https://1c3c16b4d101.ngrok-free.app/api/v1"
  : "https://api.ielts-practice.com";

export const SOCKET_URL = API_BASE_URL;

// App Configuration
export const APP_CONFIG = {
  MAX_FRIEND_REQUESTS_PER_DAY: 20,
  MAX_FRIENDS: 500,
  MAX_GROUP_MEMBERS: 15,
  MAX_GROUPS_PER_USER: 10,
  MAX_REFERRALS_PER_DAY: 5,
  MAX_MESSAGE_LENGTH: 2000,
  MESSAGE_LOAD_LIMIT: 50,
  LEADERBOARD_PAGE_SIZE: 100,
  XP_PER_LEVEL: 100,
};

export const FEATURES = {
  SOCIAL: true,
  CHAT: true,
  STUDY_GROUPS: true,
  REFERRALS: true,
  LEADERBOARD: true,
  ACHIEVEMENTS: true,
  QR_CODE_SHARING: true,
};
