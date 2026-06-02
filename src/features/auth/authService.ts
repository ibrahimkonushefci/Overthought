import { Linking } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthProvider, Profile } from '../../types/shared';
import { trackEvent } from '../../lib/analytics/analyticsService';
import { env } from '../../lib/env';
import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { useAiVerdictStore } from '../../store/aiVerdictStore';
import { useGuestStore } from '../../store/guestStore';
import { useUiPreferencesStore } from '../../store/uiPreferencesStore';
import { createId } from '../../shared/utils/id';
import { premiumService } from '../premium/premiumService';
import { profileRepository } from '../profile/profileRepository';

export interface AuthActionResult {
  ok: boolean;
  message?: string;
  needsNativeSetup?: boolean;
  cancelled?: boolean;
  disabled?: boolean;
}

interface DeleteAccountFunctionSuccess {
  ok: true;
}

interface DeleteAccountFunctionFailure {
  ok: false;
  code: 'not_authenticated' | 'delete_failed';
  message: string;
}

type DeleteAccountFunctionResponse = DeleteAccountFunctionSuccess | DeleteAccountFunctionFailure;

let listenersStarted = false;
function providerFromSupabase(provider?: string): AuthProvider {
  if (provider === 'apple' || provider === 'google' || provider === 'email') {
    return provider;
  }

  return 'unknown';
}

function profileFromSessionUser(user: {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): Profile {
  const now = new Date().toISOString();
  const displayName =
    stringMetadata(user.user_metadata?.full_name) ??
    stringMetadata(user.user_metadata?.name) ??
    user.email?.split('@')[0] ??
    null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
    authProvider: providerFromSupabase(user.app_metadata?.provider as string | undefined),
    onboardingCompleted: false,
    isGuest: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function stringMetadata(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function authErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return null;
}

function isGoogleNonceSetupError(error: unknown): boolean {
  const message = authErrorMessage(error)?.toLowerCase() ?? '';
  return message.includes('passed nonce') && message.includes('id_token');
}

async function profileForUser(user: User): Promise<Profile> {
  try {
    const profile = await profileRepository.getCurrentProfile();
    return profile ?? profileFromSessionUser(user);
  } catch {
    return profileFromSessionUser(user);
  }
}

async function applySession(session: Session | null): Promise<void> {
  const user = session?.user;

  if (!user) {
    useAuthStore.getState().setGuest();
    await premiumService.handleAuthStateChange(null);
    return;
  }

  const profile = await profileForUser(user);
  useAuthStore.getState().setAuthenticated(
    {
      id: user.id,
      email: user.email ?? null,
      provider: providerFromSupabase(user.app_metadata?.provider as string | undefined),
    },
    profile,
  );
  await premiumService.handleAuthStateChange(user.id);
}

function startAuthListeners() {
  if (listenersStarted || !supabase) {
    return;
  }

  listenersStarted = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    void applySession(session);
  });

  Linking.addEventListener('url', ({ url }) => {
    void authService.handleAuthRedirect(url);
  });
}

function urlParam(url: URL, key: string): string | null {
  const queryValue = url.searchParams.get(key);

  if (queryValue) {
    return queryValue;
  }

  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  return new URLSearchParams(hash).get(key);
}

export const authService = {
  async isAppleSignInAvailable(): Promise<boolean> {
    if (!env.enableAppleAuth) {
      return false;
    }

    try {
      return await AppleAuthentication.isAvailableAsync();
    } catch {
      return false;
    }
  },
  async bootstrap(): Promise<void> {
    const authStore = useAuthStore.getState();

    if (!supabase) {
      if (authStore.sessionMode === 'loading') {
        useAuthStore.getState().setGuest();
        await premiumService.handleAuthStateChange(null);
      }

      return;
    }

    startAuthListeners();

    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      await this.handleAuthRedirect(initialUrl);
    }

    const { data } = await supabase.auth.getSession();

    if (!data.session?.user) {
      if (authStore.sessionMode === 'loading') {
        useAuthStore.getState().setGuest();
        await premiumService.handleAuthStateChange(null);
      }

      return;
    }

    await applySession(data.session);
  },
  async handleAuthRedirect(url: string): Promise<AuthActionResult> {
    if (!supabase) {
      return { ok: false, message: 'Supabase is not configured.' };
    }

    try {
      const parsed = new URL(url);
      const code = urlParam(parsed, 'code');

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          return { ok: false, message: error.message };
        }

        await applySession(data.session);
        return { ok: true };
      }

      const accessToken = urlParam(parsed, 'access_token');
      const refreshToken = urlParam(parsed, 'refresh_token');

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          return { ok: false, message: error.message };
        }

        await applySession(data.session);
        return { ok: true };
      }

      return { ok: false, message: 'No auth session was found in the redirect link.' };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to complete sign-in.',
      };
    }
  },
  continueAsGuest(): string {
    const localGuestId = useGuestStore.getState().ensureGuestSession();
    useAuthStore.getState().markEntryComplete();
    useAuthStore.getState().setGuest();
    trackEvent('continued_as_guest', { localGuestId });
    return localGuestId;
  },
  async signInWithEmail(email: string): Promise<AuthActionResult> {
    trackEvent('auth_started', { provider: 'email' });

    if (!supabase) {
      return {
        ok: false,
        message: 'Add Supabase credentials before email sign-in can send magic links.',
      };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: env.supabaseRedirectUrl,
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, message: 'Check your email for the sign-in link.' };
  },
  async signInWithEmailPassword(email: string, password: string): Promise<AuthActionResult> {
    trackEvent('auth_started', { provider: 'email' });

    if (!supabase) {
      return {
        ok: false,
        message: 'Add Supabase credentials before email sign-in can run.',
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data.session) {
      return { ok: false, message: 'Email sign-in did not return a session. Try again.' };
    }

    await applySession(data.session);
    return { ok: true };
  },
  async signUpWithEmailPassword(email: string, password: string): Promise<AuthActionResult> {
    trackEvent('auth_started', { provider: 'email' });

    if (!supabase) {
      return {
        ok: false,
        message: 'Add Supabase credentials before email sign-up can run.',
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: env.supabaseRedirectUrl,
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (data.session) {
      await applySession(data.session);
      return { ok: true };
    }

    return {
      ok: true,
      message: 'Account created. Check your email to confirm it, then sign in. If it is not there, check Spam/Junk.',
    };
  },
  async requestPasswordReset(email: string): Promise<AuthActionResult> {
    trackEvent('auth_started', { provider: 'email' });

    if (!supabase) {
      return {
        ok: false,
        message: 'Add Supabase credentials before password reset can run.',
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: env.supabasePasswordResetRedirectUrl,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, message: 'Check your email for the password reset link. If it is not there, check Spam/Junk.' };
  },
  async updatePassword(password: string): Promise<AuthActionResult> {
    if (!supabase) {
      return {
        ok: false,
        message: 'Add Supabase credentials before password reset can run.',
      };
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, message: 'Password updated.' };
  },
  async signInWithApple(): Promise<AuthActionResult> {
    if (!env.enableAppleAuth) {
      return {
        ok: false,
        disabled: true,
        message: 'Apple sign-in is disabled for this build.',
      };
    }

    trackEvent('auth_started', { provider: 'apple' });

    if (!supabase) {
      return { ok: false, message: 'Add Supabase credentials before Apple sign-in can run.' };
    }

    const isAvailable = await AppleAuthentication.isAvailableAsync();

    if (!isAvailable) {
      return {
        ok: false,
        needsNativeSetup: true,
        message: 'Apple Sign In is not available on this device or native build.',
      };
    }

    const rawNonce = createId('apple_nonce');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        return {
          ok: false,
          needsNativeSetup: true,
          message: 'Apple did not return an identity token. Check Apple/Supabase provider setup.',
        };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) {
        return { ok: false, message: error.message };
      }

      await applySession(data.session);
      return { ok: true };
    } catch (error) {
      const errorCode = typeof error === 'object' && error && 'code' in error ? error.code : null;

      if (
        errorCode === 'ERR_REQUEST_CANCELED' ||
        (error instanceof Error && error.message.toLowerCase().includes('cancel'))
      ) {
        return { ok: false, cancelled: true, message: 'Apple sign-in was cancelled.' };
      }

      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Apple sign-in failed.',
      };
    }
  },
  async signInWithGoogle(): Promise<AuthActionResult> {
    if (!env.enableGoogleAuth) {
      return {
        ok: false,
        disabled: true,
        message: 'Google sign-in is disabled for this TestFlight build.',
      };
    }

    trackEvent('auth_started', { provider: 'google' });

    if (!supabase) {
      return { ok: false, message: 'Add Supabase credentials before Google sign-in can run.' };
    }

    if (!env.googleWebClientId || !env.googleIosClientId) {
      return {
        ok: false,
        needsNativeSetup: true,
        message: 'Add Google web and iOS client IDs before Google sign-in can run.',
      };
    }

    try {
      GoogleSignin.configure({
        webClientId: env.googleWebClientId,
        iosClientId: env.googleIosClientId,
      });

      const googleResult = await GoogleSignin.signIn();

      if (isCancelledResponse(googleResult)) {
        return { ok: false, cancelled: true, message: 'Google sign-in was cancelled.' };
      }

      if (!isSuccessResponse(googleResult)) {
        return {
          ok: false,
          message: 'Google sign-in did not complete successfully.',
        };
      }

      const idToken = googleResult.data.idToken;

      if (!idToken) {
        return {
          ok: false,
          needsNativeSetup: true,
          message: 'Google did not return the ID token needed for Supabase sign-in. Check Google OAuth client setup.',
        };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        if (isGoogleNonceSetupError(error)) {
          return {
            ok: false,
            needsNativeSetup: true,
            message:
              'Enable Skip nonce check in the Supabase Google provider for native iOS Google Sign-In, then try again.',
          };
        }

        return { ok: false, message: error.message };
      }

      await applySession(data.session);
      return { ok: true };
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { ok: false, cancelled: true, message: 'Google sign-in was cancelled.' };
      }

      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Google sign-in failed.',
      };
    }
  },
  async signOut(): Promise<void> {
    let signOutError: unknown = null;

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      signOutError = error;
    } finally {
      useAuthStore.getState().signOutLocal();
      await premiumService.handleAuthStateChange(null);
    }

    if (signOutError) {
      // Local cleanup already completed. Supabase sign-out failures should not leave the user stuck in auth state.
      return;
    }
  },
  async deleteAccount(): Promise<AuthActionResult> {
    if (useAuthStore.getState().sessionMode !== 'authenticated') {
      useGuestStore.getState().clearAllLocalData();
      useAiVerdictStore.getState().clearAllAiVerdicts();
      useUiPreferencesStore.getState().resetFirstUseHelp();
      useAuthStore.getState().resetSession();
      await premiumService.handleAuthStateChange(null);
      return { ok: true, message: 'Local data deleted.' };
    }

    if (!supabase) {
      return {
        ok: false,
        message: 'Supabase is not configured.',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke<DeleteAccountFunctionResponse>('delete-account', {
        body: {},
      });

      if (error) {
        return {
          ok: false,
          message: error.message,
        };
      }

      if (!data?.ok) {
        return {
          ok: false,
          message: data?.message ?? 'Unable to delete account right now.',
        };
      }

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // The account may already be gone remotely; local cleanup still needs to complete.
      }

      useGuestStore.getState().clearAllLocalData();
      useAiVerdictStore.getState().clearAllAiVerdicts();
      useUiPreferencesStore.getState().resetFirstUseHelp();
      useAuthStore.getState().resetSession();
      await premiumService.handleAuthStateChange(null);
      return {
        ok: true,
        message: 'Account deleted.',
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to delete account right now.',
      };
    }
  },
};
