import type { AuthProvider, Profile } from '../../types/shared';
import { supabase } from '../../lib/supabase/client';

const DISPLAY_NAME_MAX_LENGTH = 40;

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  auth_provider: AuthProvider;
  onboarding_completed: boolean;
  is_guest: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    authProvider: row.auth_provider,
    onboardingCompleted: row.onboarding_completed,
    isGuest: row.is_guest,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function normalizeDisplayName(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`);
  }

  return trimmed;
}

export const profileRepository = {
  async getCurrentProfile(): Promise<Profile | null> {
    if (!supabase) {
      return null;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      return null;
    }

    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapProfile(data as ProfileRow) : null;
  },
  async updateCurrentProfile({ displayName }: { displayName: string }): Promise<Profile> {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      throw new Error('Sign in again before updating your profile.');
    }

    const normalizedDisplayName = normalizeDisplayName(displayName);
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: normalizedDisplayName })
      .eq('id', userId)
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Profile update returned no data.');
    }

    return mapProfile(data as ProfileRow);
  },
};
