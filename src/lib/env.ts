const appVariant =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'production' || process.env.APP_VARIANT === 'production'
    ? 'production'
    : 'development';

export const passwordResetRedirectUrl = 'overthought://reset-password';

export const legalUrls = {
  privacyPolicy: 'https://overthought.app/privacy-policy.html',
  termsOfUse: 'https://overthought.app/terms-of-use.html',
} as const;

function normalizeLegalUrl(value: string | undefined, canonicalUrl: string): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return canonicalUrl;
  }

  return trimmedValue === canonicalUrl.replace('.html', '/') ? canonicalUrl : trimmedValue;
}

export const env = {
  appVariant,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  supabaseRedirectUrl: process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? 'overthought://auth',
  supabasePasswordResetRedirectUrl: passwordResetRedirectUrl,
  enableAppleAuth: process.env.EXPO_PUBLIC_ENABLE_APPLE_AUTH === 'true',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? '',
  enableGoogleAuth: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true',
  revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '',
  revenueCatAndroidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '',
  enablePremium: appVariant === 'production' && process.env.EXPO_PUBLIC_ENABLE_PREMIUM === 'true',
  privacyPolicyUrl: normalizeLegalUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL, legalUrls.privacyPolicy),
  termsUrl: normalizeLegalUrl(process.env.EXPO_PUBLIC_TERMS_URL, legalUrls.termsOfUse),
} as const;

export function hasSupabaseEnv(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
