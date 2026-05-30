import {
  accountDeletionConfirmationMessage,
  accountDeletionDetailText,
  APPLE_SUBSCRIPTIONS_URL,
} from './accountDeletionCopy';

describe('account deletion copy', () => {
  it('adds an Apple subscription warning for premium account deletion', () => {
    expect(accountDeletionConfirmationMessage(false, true)).toContain('does not cancel your Apple subscription');
    expect(accountDeletionDetailText(false, true)).toContain('App Store subscriptions');
    expect(APPLE_SUBSCRIPTIONS_URL).toBe('https://apps.apple.com/account/subscriptions');
  });

  it('does not show subscription billing copy for guest deletion', () => {
    expect(accountDeletionConfirmationMessage(true, true)).not.toContain('Apple subscription');
    expect(accountDeletionDetailText(true, true)).toContain('guest cases');
  });
});
