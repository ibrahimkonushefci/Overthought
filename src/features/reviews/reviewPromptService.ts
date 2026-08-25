import * as StoreReview from 'expo-store-review';
import { useUiPreferencesStore } from '../../store/uiPreferencesStore';

const SMART_VERDICTS_BEFORE_REVIEW = 2;
let requestInProgress = false;

export const reviewPromptService = {
  recordSuccessfulSmartVerdict(): void {
    useUiPreferencesStore.getState().recordCompletedSmartVerdict();
  },

  async requestWhenEligible(): Promise<boolean> {
    const state = useUiPreferencesStore.getState();

    if (
      requestInProgress ||
      state.hasAttemptedReviewPrompt ||
      state.completedSmartVerdicts < SMART_VERDICTS_BEFORE_REVIEW
    ) {
      return false;
    }

    requestInProgress = true;

    try {
      const isAvailable = await StoreReview.isAvailableAsync();

      const hasAction = isAvailable ? await StoreReview.hasAction() : false;

      if (!hasAction) {
        return false;
      }

      useUiPreferencesStore.getState().markReviewPromptAttempted();
      await StoreReview.requestReview();
      return true;
    } catch {
      return false;
    } finally {
      requestInProgress = false;
    }
  },
};
