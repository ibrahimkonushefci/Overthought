import { useAuthStore } from '../../store/authStore';
import { useGuestStore } from '../../store/guestStore';
import { supabase } from '../../lib/supabase/client';
import { authService } from './authService';
import { premiumService } from '../premium/premiumService';

jest.mock('../../lib/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(async () => ({ error: null })),
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

const mockSupabase = supabase as unknown as {
  auth: {
    signOut: jest.Mock;
    onAuthStateChange: jest.Mock;
    getSession: jest.Mock;
  };
  functions: {
    invoke: jest.Mock;
  };
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
