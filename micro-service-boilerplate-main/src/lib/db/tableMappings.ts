export const MODEL_TABLE_MAP: Record<string, string> = {
  User: 'users',
  UserProfile: 'user_profiles',
  UserStatus: 'user_statuses',
  FriendRequest: 'friend_requests',
  Friendship: 'friendships',
  Conversation: 'conversations',
  ChatMessage: 'chat_messages',
  StudyGroup: 'study_groups',
  StudyGroupInvite: 'study_group_invites',
  Topic: 'topics',
  PracticeSession: 'practice_sessions',
  TestPreference: 'test_preferences',
  TestSimulation: 'test_simulations',
  TestSession: 'test_sessions',
  TestEvaluation: 'test_evaluations',
  IELTSQuestion: 'ielts_questions',
  GeneratedQuestion: 'generated_questions',
  UserQuestionHistory: 'user_question_history',
  Subscription: 'subscriptions',
  UsageRecord: 'usage_records',
  Achievement: 'achievements',
  UserAchievement: 'user_achievements',
  UserStats: 'user_stats',
  Referral: 'referrals',
  UserReferralStats: 'user_referral_stats',
  Coupon: 'coupons',
  CouponUsage: 'coupon_usages',
  PointsTransaction: 'points_transactions',
  DiscountRedemption: 'discount_redemptions'
};

export const EXTRA_TABLES = {
  testHistory: 'test_history',
  audioRecordings: 'audio_recordings',
  chatFiles: 'chat_files'
} as const;
