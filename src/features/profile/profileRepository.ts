import type { AuthProvider, Profile } from '../../types/shared';
import { requireSupabase, supabase } from '../../lib/supabase/client';
import { nowIso } from '../../shared/utils/date';

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
  async markCurrentUserDeleted(): Promise<void> {
    const client = requireSupabase();
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      return;
    }

    const { error } = await client
      .from('profiles')
      .update({
        deleted_at: nowIso(),
        display_name: null,
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    // TODO: call a secured Supabase Edge Function with service-role access to delete auth.users.
  },
};
