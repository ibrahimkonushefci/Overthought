import { supabase } from '../../lib/supabase/client';
import { useAuthStore } from '../../store/authStore';
import { profileRepository } from './profileRepository';

jest.mock('../../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as unknown as {
  auth: {
    getSession: jest.Mock;
  };
  from: jest.Mock;
};

function profileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'person@example.com',
    display_name: 'Person',
    auth_provider: 'email',
    onboarding_completed: false,
    is_guest: false,
    created_at: '2026-05-22T10:00:00.000Z',
    updated_at: '2026-05-22T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function updateProfileBuilder(row: ReturnType<typeof profileRow>) {
  const builder = {
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    single: jest.fn(),
  };

  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: row, error: null });

  return builder;
}

describe('profileRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().resetSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
          },
        },
      },
    });
  });

  afterEach(() => {
    useAuthStore.getState().resetSession();
  });

  it('saves a trimmed display name', async () => {
    const builder = updateProfileBuilder(profileRow({ display_name: 'Over Thinker' }));
    mockSupabase.from.mockReturnValue(builder);

    const profile = await profileRepository.updateCurrentProfile({ displayName: '  Over Thinker  ' });

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(builder.update).toHaveBeenCalledWith({ display_name: 'Over Thinker' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(profile.displayName).toBe('Over Thinker');
  });

  it('saves a blank display name as null', async () => {
    const builder = updateProfileBuilder(profileRow({ display_name: null }));
    mockSupabase.from.mockReturnValue(builder);

    const profile = await profileRepository.updateCurrentProfile({ displayName: '   ' });

    expect(builder.update).toHaveBeenCalledWith({ display_name: null });
    expect(profile.displayName).toBeNull();
  });

  it('rejects display names over 40 characters before updating Supabase', async () => {
    await expect(profileRepository.updateCurrentProfile({ displayName: 'x'.repeat(41) })).rejects.toThrow(
      'Display name must be 40 characters or fewer.',
    );

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('lets the caller update auth store after a successful save', async () => {
    const builder = updateProfileBuilder(profileRow({ display_name: 'Fresh Name' }));
    mockSupabase.from.mockReturnValue(builder);

    const profile = await profileRepository.updateCurrentProfile({ displayName: 'Fresh Name' });
    useAuthStore.getState().setProfile(profile);

    expect(useAuthStore.getState().profile?.displayName).toBe('Fresh Name');
  });
});
