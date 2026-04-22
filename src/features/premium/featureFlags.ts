import { env } from '../../lib/env';

export const premiumFeatureFlags = {
  premiumEnabled: env.enablePremium,
  unlimitedCaseHistory: false,
  advancedStats: false,
  deeperAnalysis: false,
  toneModes: false,
  shareCards: false,
} as const;

export type PremiumFeatureFlag = keyof typeof premiumFeatureFlags;
