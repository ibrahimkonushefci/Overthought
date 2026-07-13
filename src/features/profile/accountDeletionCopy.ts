export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

const premiumBillingWarning =
  'Deleting your Overthought account does not cancel your Apple subscription. Manage or cancel it in App Store subscriptions.';

export function accountDeletionConfirmationMessage(isGuest: boolean, hasPremium: boolean): string {
  if (isGuest) {
    return 'This action cannot be undone from the app.';
  }

  if (hasPremium) {
    return `This action cannot be undone from the app.\n\n${premiumBillingWarning}`;
  }

  return 'This action cannot be undone from the app.';
}

export function accountDeletionDetailText(isGuest: boolean, hasPremium: boolean): string {
  if (isGuest) {
    return 'This permanently deletes guest cases, drafts, local session markers, and guest Smart Verdict data tied to this installation.';
  }

  if (hasPremium) {
    return `This permanently deletes your Overthought account, synced cases, and local session data, then signs you out on this device.\n\n${premiumBillingWarning}`;
  }

  return 'This permanently deletes your Overthought account, synced cases, and local session data, then signs you out on this device.';
}
