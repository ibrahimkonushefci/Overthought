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
  caseRequestId: string | null;
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
  ensureCaseRequestId: () => string;
  setCaseDraft: (caseText: string) => void;
  setPreferredCategory: (category: CaseCategory) => void;
  clearCaseDraft: () => void;
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
  caseRequestId: null,
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
      ensureCaseRequestId: () => {
        const existing = get().drafts.caseRequestId;

        if (existing) {
          return existing;
        }

        const caseRequestId = createId('smart_case');
        set((state) => ({ drafts: { ...state.drafts, caseRequestId } }));
        return caseRequestId;
      },
      setCaseDraft: (caseText) => {
        set((state) => ({
          drafts: {
            ...state.drafts,
            caseText,
            caseRequestId: caseText === state.drafts.caseText ? state.drafts.caseRequestId : null,
          },
        }));
      },
      setPreferredCategory: (preferredCategory) => {
        set((state) => ({
          drafts: {
            ...state.drafts,
            preferredCategory,
            caseRequestId:
              preferredCategory === state.drafts.preferredCategory ? state.drafts.caseRequestId : null,
          },
        }));
      },
      clearCaseDraft: () => {
        set((state) => ({
          drafts: {
            ...state.drafts,
            caseText: '',
            caseRequestId: null,
            preferredCategory: 'romance',
          },
        }));
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
            item.localId === caseId
              ? {
                  ...item,
                  legacyBasicSnapshot:
                    item.legacyBasicSnapshot ?? {
                      verdictLabel: item.verdictLabel,
                      delusionScore: item.delusionScore,
                      explanationText: item.explanationText,
                      nextMoveText: item.nextMoveText,
                      verdictVersion: item.verdictVersion,
                      triggeredSignals: item.triggeredSignals,
                    },
                  aiVerdict,
                  smartVerdict: aiVerdict.verdict,
                  resultSource: 'smart',
                  verdictLabel: aiVerdict.verdict.verdictLabel,
                  delusionScore: aiVerdict.verdict.delusionScore,
                  explanationText: aiVerdict.verdict.explanationText,
                  nextMoveText: aiVerdict.verdict.nextMoveText,
                  verdictVersion: aiVerdict.verdict.verdictVersion,
                  updatedAt: timestamp,
                }
              : item,
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
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<GuestState>;
        const drafts = persisted.drafts ?? currentState.drafts;

        return {
          ...currentState,
          ...persisted,
          cases: (persisted.cases ?? []).map(normalizeGuestCase),
          drafts: {
            ...currentState.drafts,
            ...drafts,
            caseRequestId: drafts.caseRequestId ?? null,
          },
        };
      },
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

export function normalizeGuestCase(item: GuestCaseLocal): GuestCaseLocal {
  if (item.resultSource) {
    return item;
  }

  if (item.aiVerdict) {
    return {
      ...item,
      legacyBasicSnapshot: item.aiVerdict.localFallback,
      resultSource: 'smart',
      smartVerdict: item.aiVerdict.verdict,
      verdictLabel: item.aiVerdict.verdict.verdictLabel,
      delusionScore: item.aiVerdict.verdict.delusionScore,
      explanationText: item.aiVerdict.verdict.explanationText,
      nextMoveText: item.aiVerdict.verdict.nextMoveText,
      verdictVersion: item.aiVerdict.verdict.verdictVersion,
    };
  }

  return { ...item, resultSource: 'legacy_basic' };
}

export function selectActiveGuestCases(state: GuestState): GuestCaseLocal[] {
  return state.cases
    .map(normalizeGuestCase)
    .filter((item) => !item.archivedAt && !item.deletedAt)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}
