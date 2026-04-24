import Purchases from 'react-native-purchases';
import { revenueCatClient } from './revenueCatClient';

describe('revenueCatClient.handleAuthUserChanged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call logOut when RevenueCat already reports an anonymous user', async () => {
    jest.mocked(Purchases.getAppUserID).mockResolvedValue('$RCAnonymousID:test');
    jest.mocked(Purchases.isAnonymous).mockResolvedValue(true);

    await revenueCatClient.handleAuthUserChanged(null);

    expect(Purchases.logOut).not.toHaveBeenCalled();
  });

  it('does not throw when duplicate anonymous cleanup is triggered', async () => {
    jest.mocked(Purchases.getAppUserID).mockResolvedValue('$RCAnonymousID:test');
    jest.mocked(Purchases.isAnonymous).mockResolvedValue(true);

    await expect(revenueCatClient.handleAuthUserChanged(null)).resolves.toBeUndefined();
    await expect(revenueCatClient.handleAuthUserChanged(null)).resolves.toBeUndefined();
  });
});
