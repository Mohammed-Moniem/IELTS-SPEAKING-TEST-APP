// Export all API services
export { default as achievementService } from "./achievementService";
export { default as chatService } from "./chatService";
export { default as couponService } from "./couponService";
export { default as friendService } from "./friendService";
export { default as groupService } from "./groupService";
export { default as leaderboardService } from "./leaderboardService";
export { default as mediaUploadService } from "./mediaUploadService";
export { default as pointsService } from "./pointsService";
export { default as profileService } from "./profileService";
export { default as referralService } from "./referralService";

// Export types
export type {
  Friend,
  FriendRequest,
  FriendSuggestion,
  UserSearchResult,
} from "./friendService";

export type { ChatMessage, Conversation } from "./chatService";

export type {
  MediaType,
  PickedMedia,
  UploadProgress,
  UploadResult,
} from "./mediaUploadService";

export type { GroupMember, StudyGroup, StudyGroupInvite } from "./groupService";

export type {
  ReferralHistory,
  ReferralLeaderboardEntry,
  ReferralStats,
} from "./referralService";

export type {
  Coupon,
  CouponUsageHistory,
  CouponValidation,
} from "./couponService";

export type { LeaderboardEntry, UserPosition } from "./leaderboardService";

export type {
  Achievement,
  AchievementCategory,
  UserAchievement,
} from "./achievementService";

export { DiscountTier } from "./pointsService";
export type {
  PointsSummary,
  PointsTransaction,
  RedeemDiscountResponse,
} from "./pointsService";

export type { UserProfile, UserStatistics } from "./profileService";
