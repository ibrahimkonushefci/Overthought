import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { supabase } from '../../lib/supabase/client';
import { env } from '../../lib/env';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { authService } from './authService';
import { premiumService } from '../premium/premiumService';

jest.mock('../../lib/env', () => ({
  env: {
    appVariant: 'development',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon-key',
    supabaseRedirectUrl: 'overthought://auth',
    enableAppleAuth: false,
    googleIosClientId: '',
    googleWebClientId: '',
    googleIosUrlScheme: '',
    enableGoogleAuth: false,
    revenueCatIosApiKey: '',
    revenueCatAndroidApiKey: '',
    enablePremium: false,
    privacyPolicyUrl: '',
    termsUrl: '',
  },
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: {
    EMAIL: 'EMAIL',
    FULL_NAME: 'FULL_NAME',
  },
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
  },
  isCancelledResponse: jest.fn((response) => response?.type === 'cancelled'),
  isSuccessResponse: jest.fn((response) => response?.type === 'success'),
  isErrorWithCode: jest.fn((error) => Boolean(error && typeof error === 'object' && 'code' in error)),
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  },
}));

jest.mock('../../lib/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(async () => ({ error: null })),
      signInWithIdToken: jest.fn(),
      onAuthStateChange: jest.fn(),
      getSession: jest.fn(async () => ({ data: { session: null } })),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('../premium/premiumService', () => ({
  premiumService: {
    handleAuthStateChange: jest.fn(),
  },
}));

jest.mock('../profile/profileRepository', () => ({
  profileRepository: {
    getCurrentProfile: jest.fn(async () => null),
  },
}));

const mockSupabase = supabase as unknown as {
  auth: {
    signOut: jest.Mock;
    signInWithIdToken: jest.Mock;
    onAuthStateChange: jest.Mock;
    getSession: jest.Mock;
  };
  functions: {
    invoke: jest.Mock;
  };
};
const mutableEnv = env as unknown as {
  enableAppleAuth: boolean;
  enableGoogleAuth: boolean;
  googleWebClientId: string;
  googleIosClientId: string;
};
const mockAppleAuthentication = AppleAuthentication as unknown as {
  isAvailableAsync: jest.Mock;
  signInAsync: jest.Mock;
};
const mockGoogleSignin = GoogleSignin as unknown as {
  configure: jest.Mock;
  signIn: jest.Mock;
};

function buildGuestCase() {
  return {
    localId: 'case-local-1',
    localOwnerId: 'guest-local-1',
    title: 'Story reply',
    category: 'romance' as const,
    inputText: 'They liked my story.',
    verdictLabel: 'mild_delusion' as const,
    delusionScore: 61,
    explanationText: 'The facts are thin.',
    nextMoveText: 'Wait for one more signal.',
    verdictVersion: 1,
    triggeredSignals: ['single_low_signal'],
    outcomeStatus: 'unknown' as const,
    lastAnalyzedAt: '2026-04-22T10:00:00.000Z',
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    updates: [],
    syncStatus: 'local_only' as const,
  };
}

describe('authService.deleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mutableEnv.enableAppleAuth = false;
    mutableEnv.enableGoogleAuth = false;
    mutableEnv.googleWebClientId = '';
    mutableEnv.googleIosClientId = '';
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
  });

  it('clears guest data and resets the entry state for guest deletion', async () => {
    useAuthStore.getState().markEntryComplete();
    useAuthStore.getState().setGuest();
    useGuestStore.getState().ensureGuestSession();
    useGuestStore.getState().addCase(buildGuestCase());
    useGuestStore.getState().setCaseDraft('draft');

    const result = await authService.deleteAccount();

    expect(result).toEqual({ ok: true, message: 'Local data deleted.' });
    expect(useGuestStore.getState().cases).toHaveLength(0);
    expect(useGuestStore.getState().drafts.caseText).toBe('');
    expect(useAuthStore.getState().sessionMode).toBe('guest');
    expect(useAuthStore.getState().hasCompletedEntry).toBe(false);
    expect(premiumService.handleAuthStateChange).toHaveBeenCalledWith(null);
  });

  it('deletes an authenticated account through the secure backend path and clears local state', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    useGuestStore.getState().addCase(buildGuestCase());
    useGuestStore.getState().setCaseDraft('draft');
    mockSupabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await authService.deleteAccount();

    expect(result).toEqual({ ok: true, message: 'Account deleted.' });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('delete-account', { body: {} });
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(useGuestStore.getState().cases).toHaveLength(0);
    expect(useAuthStore.getState().sessionMode).toBe('guest');
    expect(useAuthStore.getState().hasCompletedEntry).toBe(false);
    expect(premiumService.handleAuthStateChange).toHaveBeenCalledWith(null);
  });

  it('keeps the authenticated session intact when secure deletion fails', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { ok: false, code: 'delete_failed', message: 'Delete failed.' },
      error: null,
    });

    const result = await authService.deleteAccount();

    expect(result).toEqual({ ok: false, message: 'Delete failed.' });
    expect(useAuthStore.getState().sessionMode).toBe('authenticated');
    expect(useAuthStore.getState().hasCompletedEntry).toBe(true);
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('still clears local auth state if Supabase signOut throws during logout cleanup', async () => {
    useAuthStore.getState().setAuthenticated({
      id: 'user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    mockSupabase.auth.signOut.mockRejectedValueOnce(new Error('sign out failed'));

    await expect(authService.signOut()).resolves.toBeUndefined();

    expect(useAuthStore.getState().sessionMode).toBe('guest');
    expect(premiumService.handleAuthStateChange).toHaveBeenCalledWith(null);
  });
});

describe('authService.signInWithApple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mutableEnv.enableAppleAuth = false;
    mutableEnv.enableGoogleAuth = false;
    mutableEnv.googleWebClientId = '';
    mutableEnv.googleIosClientId = '';
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
  });

  it('stays disabled until the Apple auth env flag is enabled', async () => {
    const result = await authService.signInWithApple();

    expect(result).toEqual({
      ok: false,
      disabled: true,
      message: 'Apple sign-in is disabled for this build.',
    });
    expect(mockAppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('returns native setup guidance when Apple Sign In is unavailable', async () => {
    mutableEnv.enableAppleAuth = true;
    mockAppleAuthentication.isAvailableAsync.mockResolvedValue(false);

    const result = await authService.signInWithApple();

    expect(result).toEqual({
      ok: false,
      needsNativeSetup: true,
      message: 'Apple Sign In is not available on this device or native build.',
    });
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('signs in with the Apple identity token through Supabase', async () => {
    mutableEnv.enableAppleAuth = true;
    mockAppleAuthentication.isAvailableAsync.mockResolvedValue(true);
    mockAppleAuthentication.signInAsync.mockResolvedValue({ identityToken: 'apple-id-token' });
    mockSupabase.auth.signInWithIdToken.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'apple-user-1',
            email: 'person@example.com',
            app_metadata: { provider: 'apple' },
            user_metadata: {},
          },
        },
      },
      error: null,
    });

    const result = await authService.signInWithApple();

    expect(result).toEqual({ ok: true });
    expect(mockAppleAuthentication.signInAsync).toHaveBeenCalledWith({
      requestedScopes: ['FULL_NAME', 'EMAIL'],
      nonce: 'hashed-nonce',
    });
    expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
      nonce: expect.any(String),
    });
    expect(useAuthStore.getState().sessionMode).toBe('authenticated');
    expect(useAuthStore.getState().user?.provider).toBe('apple');
    expect(premiumService.handleAuthStateChange).toHaveBeenCalledWith('apple-user-1');
  });

  it('treats Apple cancellation as a non-failing cancelled result', async () => {
    mutableEnv.enableAppleAuth = true;
    mockAppleAuthentication.isAvailableAsync.mockResolvedValue(true);
    mockAppleAuthentication.signInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    const result = await authService.signInWithApple();

    expect(result).toEqual({
      ok: false,
      cancelled: true,
      message: 'Apple sign-in was cancelled.',
    });
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });
});

describe('authService.signInWithGoogle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mutableEnv.enableAppleAuth = false;
    mutableEnv.enableGoogleAuth = false;
    mutableEnv.googleWebClientId = '';
    mutableEnv.googleIosClientId = '';
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
  });

  it('stays disabled until the Google auth env flag is enabled', async () => {
    const result = await authService.signInWithGoogle();

    expect(result).toEqual({
      ok: false,
      disabled: true,
      message: 'Google sign-in is disabled for this TestFlight build.',
    });
    expect(mockGoogleSignin.configure).not.toHaveBeenCalled();
    expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('requires both Google web and iOS client IDs', async () => {
    mutableEnv.enableGoogleAuth = true;
    mutableEnv.googleWebClientId = 'web-client-id';

    const result = await authService.signInWithGoogle();

    expect(result).toEqual({
      ok: false,
      needsNativeSetup: true,
      message: 'Add Google web and iOS client IDs before Google sign-in can run.',
    });
    expect(mockGoogleSignin.configure).not.toHaveBeenCalled();
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('signs in with the Google identity token through Supabase', async () => {
    mutableEnv.enableGoogleAuth = true;
    mutableEnv.googleWebClientId = 'web-client-id';
    mutableEnv.googleIosClientId = 'ios-client-id';
    mockGoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id-token',
        serverAuthCode: null,
        scopes: ['email', 'profile'],
        user: {
          id: 'google-subject-1',
          name: 'Person Example',
          email: 'person@example.com',
          photo: null,
          familyName: 'Example',
          givenName: 'Person',
        },
      },
    });
    mockSupabase.auth.signInWithIdToken.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'google-user-1',
            email: 'person@example.com',
            app_metadata: { provider: 'google' },
            user_metadata: { full_name: 'Person Example' },
          },
        },
      },
      error: null,
    });

    const result = await authService.signInWithGoogle();

    expect(result).toEqual({ ok: true });
    expect(mockGoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: 'web-client-id',
      iosClientId: 'ios-client-id',
    });
    expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
    });
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalledWith(expect.objectContaining({ nonce: expect.anything() }));
    expect(useAuthStore.getState().sessionMode).toBe('authenticated');
    expect(useAuthStore.getState().user?.provider).toBe('google');
    expect(premiumService.handleAuthStateChange).toHaveBeenCalledWith('google-user-1');
  });

  it('returns native setup guidance when Google does not return an ID token', async () => {
    mutableEnv.enableGoogleAuth = true;
    mutableEnv.googleWebClientId = 'web-client-id';
    mutableEnv.googleIosClientId = 'ios-client-id';
    mockGoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: {
        idToken: null,
        serverAuthCode: null,
        scopes: ['email', 'profile'],
        user: {
          id: 'google-subject-1',
          name: null,
          email: 'person@example.com',
          photo: null,
          familyName: null,
          givenName: null,
        },
      },
    });

    const result = await authService.signInWithGoogle();

    expect(result).toEqual({
      ok: false,
      needsNativeSetup: true,
      message: 'Google did not return the ID token needed for Supabase sign-in. Check Google OAuth client setup.',
    });
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('returns Supabase setup guidance when native Google ID-token sign-in hits a nonce check error', async () => {
    mutableEnv.enableGoogleAuth = true;
    mutableEnv.googleWebClientId = 'web-client-id';
    mutableEnv.googleIosClientId = 'ios-client-id';
    mockGoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id-token',
        serverAuthCode: null,
        scopes: ['email', 'profile'],
        user: {
          id: 'google-subject-1',
          name: 'Person Example',
          email: 'person@example.com',
          photo: null,
          familyName: 'Example',
          givenName: 'Person',
        },
      },
    });
    mockSupabase.auth.signInWithIdToken.mockResolvedValue({
      data: { session: null },
      error: { message: 'Passed nonce and nonce in id_token should either both exist or not.' },
    });

    const result = await authService.signInWithGoogle();

    expect(result).toEqual({
      ok: false,
      needsNativeSetup: true,
      message:
        'Enable Skip nonce check in the Supabase Google provider for native iOS Google Sign-In, then try again.',
    });
    expect(mockSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
    });
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalledWith(expect.objectContaining({ nonce: expect.anything() }));
  });

  it('treats Google cancellation responses as cancelled results', async () => {
    mutableEnv.enableGoogleAuth = true;
    mutableEnv.googleWebClientId = 'web-client-id';
    mutableEnv.googleIosClientId = 'ios-client-id';
    mockGoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });

    const result = await authService.signInWithGoogle();

    expect(result).toEqual({
      ok: false,
      cancelled: true,
      message: 'Google sign-in was cancelled.',
    });
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('treats native Google cancellation errors as cancelled results', async () => {
    mutableEnv.enableGoogleAuth = true;
    mutableEnv.googleWebClientId = 'web-client-id';
    mutableEnv.googleIosClientId = 'ios-client-id';
    mockGoogleSignin.signIn.mockRejectedValue({ code: statusCodes.SIGN_IN_CANCELLED });

    const result = await authService.signInWithGoogle();

    expect(result).toEqual({
      ok: false,
      cancelled: true,
      message: 'Google sign-in was cancelled.',
    });
    expect(mockSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });
});
