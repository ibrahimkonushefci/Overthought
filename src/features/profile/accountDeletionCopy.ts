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
    return 'This clears guest cases, drafts, and local session markers from this device.';
  }

  if (hasPremium) {
    return `This permanently deletes your Overthought account, synced cases, and local session data, then signs you out on this device.\n\n${premiumBillingWarning}`;
  }

  return 'This permanently deletes your Overthought account, synced cases, and local session data, then signs you out on this device.';
}
