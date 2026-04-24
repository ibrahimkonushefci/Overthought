export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  supabaseRedirectUrl: process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? 'overthought://auth',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? '',
  revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '',
  revenueCatAndroidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '',
  enablePremium: process.env.EXPO_PUBLIC_ENABLE_PREMIUM === 'true',
} as const;

export function hasSupabaseEnv(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
