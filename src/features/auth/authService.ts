import { Linking } from 'react-native';
// import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthProvider, Profile } from '../../types/shared';
import { trackEvent } from '../../lib/analytics/analyticsService';
import { env } from '../../lib/env';
import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { createId } from '../../shared/utils/id';
import { profileRepository } from '../profile/profileRepository';

const APPLE_AUTH_ENABLED = false;

export interface AuthActionResult {
  ok: boolean;
  message?: string;
  needsNativeSetup?: boolean;
  cancelled?: boolean;
}

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
  async bootstrap(): Promise<void> {
    const authStore = useAuthStore.getState();

    if (!supabase) {
      if (authStore.sessionMode === 'loading') {
        useAuthStore.getState().setGuest();
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
  async signInWithApple(): Promise<AuthActionResult> {
    return {
      ok: false,
      needsNativeSetup: true,
      message: 'Apple sign-in is disabled for now. Re-enable it after Apple developer setup is complete.',
    };

    /* // TODO: Uncomment all of this when the $99 Apple Developer fee is paid and expo-apple-authentication is reinstalled
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
    */
  },
  async signInWithGoogle(): Promise<AuthActionResult> {
    trackEvent('auth_started', { provider: 'google' });

    if (!supabase) {
      return { ok: false, message: 'Add Supabase credentials before Google sign-in can run.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: env.supabaseRedirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        return { ok: false, message: error.message };
      }

      if (!data?.url) {
        return {
          ok: false,
          message: 'Google sign-in could not create an auth URL.',
        };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, env.supabaseRedirectUrl);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { ok: false, cancelled: true, message: 'Google sign-in was cancelled.' };
      }

      if (result.type !== 'success') {
        return {
          ok: false,
          message: 'Google sign-in did not complete successfully.',
        };
      }

      return await this.handleAuthRedirect(result.url);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Google sign-in failed.',
      };
    }
  },
  async signOut(): Promise<void> {
    if (supabase) {
      await supabase.auth.signOut();
    }

    useAuthStore.getState().signOutLocal();
  },
  async deleteAccount(): Promise<AuthActionResult> {
    if (useAuthStore.getState().sessionMode !== 'authenticated') {
      useGuestStore.getState().clearAllLocalData();
      useAuthStore.getState().setGuest();
      return { ok: true };
    }

    try {
      await profileRepository.markCurrentUserDeleted();
      await this.signOut();
      return {
        ok: true,
        message: 'Account deletion was requested. Complete auth-user deletion in the secured Supabase function.',
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to delete account right now.',
      };
    }
  },
};
