import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  CaseAiVerdictSnapshot,
  CaseCategory,
  GuestCaseLocal,
  GuestCaseUpdateLocal,
  OutcomeStatus,
} from '../types/shared';
import { nowIso } from '../shared/utils/date';
import { createId } from '../shared/utils/id';
import { zustandMmkvStorage } from '../storage/mmkv';

interface DraftState {
  caseText: string;
  updateTextByCaseId: Record<string, string>;
  preferredCategory: CaseCategory;
}

interface GuestState {
  localGuestId: string | null;
  guestAiKey: string | null;
  cases: GuestCaseLocal[];
  drafts: DraftState;
  migratedCaseMap: Record<string, string>;
  migrationPromptByUserId: Record<string, 'skipped' | 'completed'>;
  ensureGuestSession: () => string;
  ensureGuestAiKey: () => string;
  setCaseDraft: (caseText: string) => void;
  setPreferredCategory: (category: CaseCategory) => void;
  setUpdateDraft: (caseId: string, updateText: string) => void;
  addCase: (record: GuestCaseLocal) => void;
  replaceCase: (record: GuestCaseLocal) => void;
  attachAiVerdict: (caseId: string, aiVerdict: CaseAiVerdictSnapshot) => void;
  addUpdate: (caseId: string, update: GuestCaseUpdateLocal) => void;
  updateOutcome: (caseId: string, outcomeStatus: OutcomeStatus) => void;
  archiveCase: (caseId: string) => void;
  clearCases: () => void;
  markCaseMigrated: (localCaseId: string, remoteCaseId: string) => void;
  markMigrationPromptSkipped: (userId: string) => void;
  markMigrationPromptCompleted: (userId: string) => void;
  clearGuestSessionData: () => void;
  clearMigratedCases: () => void;
  clearAllLocalData: () => void;
}

const initialDrafts: DraftState = {
  caseText: '',
  updateTextByCaseId: {},
  preferredCategory: 'romance',
};

export const useGuestStore = create<GuestState>()(
  persist(
    (set, get) => ({
      localGuestId: null,
      guestAiKey: null,
      cases: [],
      drafts: initialDrafts,
      migratedCaseMap: {},
      migrationPromptByUserId: {},
      ensureGuestSession: () => {
        const existing = get().localGuestId;

        if (existing) {
          return existing;
        }

        const localGuestId = createId('guest');
        set({ localGuestId });
        return localGuestId;
      },
      ensureGuestAiKey: () => {
        const existing = get().guestAiKey;

        if (existing) {
          return existing;
        }

        const guestAiKey = createId('guest_ai');
        set({ guestAiKey });
        return guestAiKey;
      },
      setCaseDraft: (caseText) => {
        set((state) => ({ drafts: { ...state.drafts, caseText } }));
      },
      setPreferredCategory: (preferredCategory) => {
        set((state) => ({ drafts: { ...state.drafts, preferredCategory } }));
      },
      setUpdateDraft: (caseId, updateText) => {
        set((state) => ({
          drafts: {
            ...state.drafts,
            updateTextByCaseId: {
              ...state.drafts.updateTextByCaseId,
              [caseId]: updateText,
            },
          },
        }));
      },
      addCase: (record) => {
        set((state) => ({
          cases: [record, ...state.cases],
          drafts: { ...state.drafts, caseText: '' },
        }));
      },
      replaceCase: (record) => {
        set((state) => ({
          cases: state.cases.map((item) => (item.localId === record.localId ? record : item)),
        }));
      },
      attachAiVerdict: (caseId, aiVerdict) => {
        const timestamp = nowIso();
        set((state) => ({
          cases: state.cases.map((item) =>
            item.localId === caseId ? { ...item, aiVerdict, updatedAt: timestamp } : item,
          ),
        }));
      },
      addUpdate: (caseId, update) => {
        const timestamp = nowIso();
        set((state) => ({
          cases: state.cases.map((item) =>
            item.localId === caseId
              ? {
                  ...item,
                  updates: [update, ...item.updates],
                  updatedAt: timestamp,
                }
              : item,
          ),
          drafts: {
            ...state.drafts,
            updateTextByCaseId: {
              ...state.drafts.updateTextByCaseId,
              [caseId]: '',
            },
          },
        }));
      },
      updateOutcome: (caseId, outcomeStatus) => {
        const timestamp = nowIso();
        set((state) => ({
          cases: state.cases.map((item) =>
            item.localId === caseId ? { ...item, outcomeStatus, updatedAt: timestamp } : item,
          ),
        }));
      },
      archiveCase: (caseId) => {
        const timestamp = nowIso();
        set((state) => ({
          cases: state.cases.map((item) =>
            item.localId === caseId ? { ...item, archivedAt: timestamp, updatedAt: timestamp } : item,
          ),
        }));
      },
      clearCases: () => {
        set((state) => ({
          cases: [],
          migratedCaseMap: {},
          drafts: {
            ...state.drafts,
            updateTextByCaseId: {},
          },
        }));
      },
      markCaseMigrated: (localCaseId, remoteCaseId) => {
        set((state) => ({
          migratedCaseMap: { ...state.migratedCaseMap, [localCaseId]: remoteCaseId },
          cases: state.cases.map((item) =>
            item.localId === localCaseId ? { ...item, syncStatus: 'pending_migration' } : item,
          ),
        }));
      },
      markMigrationPromptSkipped: (userId) => {
        set((state) => ({
          migrationPromptByUserId: {
            ...state.migrationPromptByUserId,
            [userId]: 'skipped',
          },
        }));
      },
      markMigrationPromptCompleted: (userId) => {
        set((state) => ({
          migrationPromptByUserId: {
            ...state.migrationPromptByUserId,
            [userId]: 'completed',
          },
        }));
      },
      clearGuestSessionData: () => {
        set((state) => ({
          localGuestId: null,
          guestAiKey: null,
          cases: [],
          drafts: initialDrafts,
          migratedCaseMap: {},
          migrationPromptByUserId: state.migrationPromptByUserId,
        }));
      },
      clearMigratedCases: () => {
        set((state) => ({
          cases: state.cases.filter((item) => !state.migratedCaseMap[item.localId]),
        }));
      },
      clearAllLocalData: () => {
        set({
          localGuestId: null,
          guestAiKey: null,
          cases: [],
          drafts: initialDrafts,
          migratedCaseMap: {},
          migrationPromptByUserId: {},
        });
      },
    }),
    {
      name: 'overthought-guest-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state) => ({
        localGuestId: state.localGuestId,
        guestAiKey: state.guestAiKey,
        cases: state.cases,
        drafts: state.drafts,
        migratedCaseMap: state.migratedCaseMap,
        migrationPromptByUserId: state.migrationPromptByUserId,
      }),
    },
  ),
);

export function selectActiveGuestCases(state: GuestState): GuestCaseLocal[] {
  return state.cases
    .filter((item) => !item.archivedAt && !item.deletedAt)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}
