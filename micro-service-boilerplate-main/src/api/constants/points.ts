export enum DiscountTier {
  TIER_5 = '5%', // 1,000 points
  TIER_10 = '10%', // 2,500 points
  TIER_15 = '15%', // 5,000 points
  TIER_20 = '20%' // 7,500 points (cap)
}

export const DISCOUNT_TIERS = [
  { tier: DiscountTier.TIER_5, pointsRequired: 1000, percentage: 5 },
  { tier: DiscountTier.TIER_10, pointsRequired: 2500, percentage: 10 },
  { tier: DiscountTier.TIER_15, pointsRequired: 5000, percentage: 15 },
  { tier: DiscountTier.TIER_20, pointsRequired: 7500, percentage: 20 }
] as const;

