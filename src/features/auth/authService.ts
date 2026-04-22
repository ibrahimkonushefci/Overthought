import type { AuthProvider, Profile } from '../../types/shared';
import { trackEvent } from '../../lib/analytics/analyticsService';
import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { profileRepository } from '../profile/profileRepository';

export interface AuthActionResult {
  ok: boolean;
  message?: string;
  needsNativeSetup?: boolean;
}

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
}): Profile | null {
  return null;
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

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      if (authStore.sessionMode === 'loading') {
        useAuthStore.getState().setGuest();
      }

      return;
    }

    const profile = await profileRepository.getCurrentProfile();
    useAuthStore.getState().setAuthenticated(
      {
        id: user.id,
        email: user.email ?? null,
        provider: providerFromSupabase(user.app_metadata?.provider as string | undefined),
      },
      profile ?? profileFromSessionUser(user),
    );
  },
  continueAsGuest(): string {
    const localGuestId = useGuestStore.getState().ensureGuestSession();
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
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, message: 'Check your email for the sign-in link.' };
  },
  async signInWithApple(): Promise<AuthActionResult> {
    trackEvent('auth_started', { provider: 'apple' });

    return {
      ok: false,
      needsNativeSetup: true,
      message: 'Apple sign-in needs native credentials and entitlement setup.',
    };
  },
  async signInWithGoogle(): Promise<AuthActionResult> {
    trackEvent('auth_started', { provider: 'google' });

    return {
      ok: false,
      needsNativeSetup: true,
      message: 'Google sign-in needs OAuth client IDs and native setup.',
    };
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
