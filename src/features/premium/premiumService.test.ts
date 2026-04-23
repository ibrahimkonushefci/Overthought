jest.mock('../../lib/supabase/client', () => ({
  supabase: null,
}));

import { premiumFeatureFlags } from './featureFlags';
import { premiumService } from './premiumService';

describe('premiumService', () => {
  it('keeps premium disabled by default', () => {
    expect(premiumFeatureFlags.premiumEnabled).toBe(false);
    expect(premiumService.canUseFeature('premiumEnabled')).toBe(false);
  });

  it('does not gate v1 features while premium is disabled', () => {
    expect(premiumService.canUseFeature('deeperAnalysis')).toBe(true);
    expect(premiumService.canUseFeature('shareCards')).toBe(true);
  });

  it('returns a free state for guests', async () => {
    const state = await premiumService.getPremiumState();

    expect(state.userId).toBe('guest');
    expect(state.entitlementStatus).toBe('free');
    expect(state.source).toBe('none');
  });
});
