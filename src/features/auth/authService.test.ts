import { useAuthStore } from '../../store/authStore';
import { useAiVerdictStore } from '../../store/aiVerdictStore';
import { useGuestStore } from '../../store/guestStore';
import { useUiPreferencesStore } from '../../store/uiPreferencesStore';
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
    supabasePasswordResetRedirectUrl: 'overthought://reset-password',
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
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
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
    signInWithPassword: jest.Mock;
    signUp: jest.Mock;
    resetPasswordForEmail: jest.Mock;
    updateUser: jest.Mock;
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

function buildAiVerdictSnapshot() {
  const localFallback = {
    verdictLabel: 'mild_delusion' as const,
    delusionScore: 61,
    explanationText: 'The facts are thin.',
    nextMoveText: 'Wait for one more signal.',
    verdictVersion: 1,
    triggeredSignals: [],
  };

  return {
    verdict: {
      ...localFallback,
      source: 'ai' as const,
      displayLabel: 'Mild delusion',
      evidenceCheckText: 'Thin evidence.',
      overreadingText: 'You are overreading the timing.',
      whatMattersText: 'Whether they follow through.',
    },
    localFallback,
    cache: {
      id: 'ai-verdict-1',
      source: 'generated' as const,
      targetFingerprint: 'fingerprint-1',
      modelProvider: 'google',
      modelName: 'gemini',
      modelVersion: null,
      promptVersion: 3,
      responseSchemaVersion: 1,
      createdAt: '2026-04-22T10:00:00.000Z',
    },
    access: {
      accessTier: 'free' as const,
      allowed: true,
      used: 1,
      remaining: 1,
      limit: 2,
      quotaBucket: '2026-04-22',
      quotaScope: 'daily' as const,
    },
    updatedAt: '2026-04-22T10:00:00.000Z',
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
    useAiVerdictStore.getState().clearAllAiVerdicts();
    useUiPreferencesStore.getState().resetFirstUseHelp();
    useAuthStore.getState().resetSession();
  });

  it('clears guest data and resets the entry state for guest deletion', async () => {
    useAuthStore.getState().markEntryComplete();
    useAuthStore.getState().setGuest();
    useGuestStore.getState().ensureGuestSession();
    useGuestStore.getState().addCase(buildGuestCase());
    useGuestStore.getState().setCaseDraft('draft');
    useUiPreferencesStore.getState().markFirstUseHelpSeen();
    useAiVerdictStore.getState().setAiVerdict('case-local-1', buildAiVerdictSnapshot());
    useAiVerdictStore.getState().setRequestState('case-local-1', {
      status: 'quota_exceeded',
      updatedAt: '2026-04-22T10:00:00.000Z',
    });

    const result = await authService.deleteAccount();

    expect(result).toEqual({ ok: true, message: 'Local data deleted.' });
    expect(useGuestStore.getState().cases).toHaveLength(0);
    expect(useGuestStore.getState().drafts.caseText).toBe('');
    expect(useAiVerdictStore.getState().byCaseId).toEqual({});
    expect(useAiVerdictStore.getState().requestByCaseId).toEqual({});
    expect(useUiPreferencesStore.getState().hasSeenFirstUseHelp).toBe(false);
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
    useUiPreferencesStore.getState().markFirstUseHelpSeen();
    useAiVerdictStore.getState().setAiVerdict('remote-case-1', buildAiVerdictSnapshot());
    useAiVerdictStore.getState().setRequestState('remote-case-1', {
      status: 'quota_exceeded',
      updatedAt: '2026-04-22T10:00:00.000Z',
    });
    mockSupabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await authService.deleteAccount();

    expect(result).toEqual({ ok: true, message: 'Account deleted.' });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('delete-account', { body: {} });
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(useGuestStore.getState().cases).toHaveLength(0);
    expect(useAiVerdictStore.getState().byCaseId).toEqual({});
    expect(useAiVerdictStore.getState().requestByCaseId).toEqual({});
    expect(useUiPreferencesStore.getState().hasSeenFirstUseHelp).toBe(false);
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
    useUiPreferencesStore.getState().markFirstUseHelpSeen();
    mockSupabase.auth.signOut.mockRejectedValueOnce(new Error('sign out failed'));

    await expect(authService.signOut()).resolves.toBeUndefined();

    expect(useAuthStore.getState().sessionMode).toBe('guest');
    expect(useUiPreferencesStore.getState().hasSeenFirstUseHelp).toBe(true);
    expect(premiumService.handleAuthStateChange).toHaveBeenCalledWith(null);
  });
});

describe('authService email password auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mutableEnv.enableAppleAuth = false;
    mutableEnv.enableGoogleAuth = false;
    mutableEnv.googleWebClientId = '';
    mutableEnv.googleIosClientId = '';
    useGuestStore.getState().clearAllLocalData();
    useAuthStore.getState().resetSession();
  });

  it('signs in with email and password through Supabase', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'email-user-1',
            email: 'person@example.com',
            app_metadata: { provider: 'email' },
            user_metadata: {},
          },
        },
      },
      error: null,
    });

    const result = await authService.signInWithEmailPassword('person@example.com', 'password123');

    expect(result).toEqual({ ok: true });
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'password123',
    });
    expect(useAuthStore.getState().sessionMode).toBe('authenticated');
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'email-user-1',
      email: 'person@example.com',
      provider: 'email',
    });
    expect(premiumService.handleAuthStateChange).toHaveBeenCalledWith('email-user-1');
  });

  it('returns Supabase email password sign-in errors without changing local auth state', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });

    const result = await authService.signInWithEmailPassword('person@example.com', 'password123');

    expect(result).toEqual({ ok: false, message: 'Invalid login credentials' });
    expect(useAuthStore.getState().sessionMode).toBe('guest');
    expect(premiumService.handleAuthStateChange).not.toHaveBeenCalled();
  });

  it('creates an email password account and applies the session when confirmation is not required', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'email-user-2',
            email: 'new@example.com',
            app_metadata: { provider: 'email' },
            user_metadata: {},
          },
        },
      },
      error: null,
    });

    const result = await authService.signUpWithEmailPassword('new@example.com', 'password123');

    expect(result).toEqual({ ok: true });
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: {
        emailRedirectTo: 'overthought://auth',
      },
    });
    expect(useAuthStore.getState().sessionMode).toBe('authenticated');
    expect(useAuthStore.getState().user?.id).toBe('email-user-2');
    expect(premiumService.handleAuthStateChange).toHaveBeenCalledWith('email-user-2');
  });

  it('returns a confirmation message when email password signup needs email confirmation', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const result = await authService.signUpWithEmailPassword('new@example.com', 'password123');

    expect(result).toEqual({
      ok: true,
      message: 'Account created. Check your email to confirm it, then sign in. If it is not there, check Spam/Junk.',
    });
    expect(useAuthStore.getState().sessionMode).toBe('guest');
    expect(premiumService.handleAuthStateChange).not.toHaveBeenCalled();
  });

  it('requests a password reset email with the dedicated reset redirect', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await authService.requestPasswordReset('person@example.com');

    expect(result).toEqual({
      ok: true,
      message: 'Check your email for the password reset link. If it is not there, check Spam/Junk.',
    });
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.com', {
      redirectTo: 'overthought://reset-password',
    });
  });

  it('returns password reset request errors from Supabase', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'For security purposes, you can only request this once every 60 seconds' },
    });

    const result = await authService.requestPasswordReset('person@example.com');

    expect(result).toEqual({
      ok: false,
      message: 'For security purposes, you can only request this once every 60 seconds',
    });
  });

  it('updates the password for a recovery session', async () => {
    mockSupabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'email-user-1' } }, error: null });

    const result = await authService.updatePassword('newpassword123');

    expect(result).toEqual({ ok: true, message: 'Password updated.' });
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword123' });
  });

  it('returns password update errors from Supabase', async () => {
    mockSupabase.auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth session missing' },
    });

    const result = await authService.updatePassword('newpassword123');

    expect(result).toEqual({ ok: false, message: 'Auth session missing' });
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
