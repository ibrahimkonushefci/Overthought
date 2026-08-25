import * as StoreReview from 'expo-store-review';
import { useUiPreferencesStore } from '../../store/uiPreferencesStore';
import { reviewPromptService } from './reviewPromptService';

jest.mock('expo-store-review', () => ({
  hasAction: jest.fn(),
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

const hasActionMock = StoreReview.hasAction as jest.MockedFunction<typeof StoreReview.hasAction>;
const isAvailableMock = StoreReview.isAvailableAsync as jest.MockedFunction<typeof StoreReview.isAvailableAsync>;
const requestReviewMock = StoreReview.requestReview as jest.MockedFunction<typeof StoreReview.requestReview>;

describe('reviewPromptService', () => {
  beforeEach(() => {
    useUiPreferencesStore.setState({
      completedSmartVerdicts: 0,
      hasAttemptedReviewPrompt: false,
    });
    hasActionMock.mockResolvedValue(true);
    isAvailableMock.mockResolvedValue(true);
    requestReviewMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('waits until two successful Smart Verdicts have completed', async () => {
    reviewPromptService.recordSuccessfulSmartVerdict();

    await expect(reviewPromptService.requestWhenEligible()).resolves.toBe(false);
    expect(requestReviewMock).not.toHaveBeenCalled();
  });

  it('requests the native review once after the second Smart Verdict', async () => {
    reviewPromptService.recordSuccessfulSmartVerdict();
    reviewPromptService.recordSuccessfulSmartVerdict();

    await expect(reviewPromptService.requestWhenEligible()).resolves.toBe(true);
    await expect(reviewPromptService.requestWhenEligible()).resolves.toBe(false);
    expect(requestReviewMock).toHaveBeenCalledTimes(1);
    expect(useUiPreferencesStore.getState().hasAttemptedReviewPrompt).toBe(true);
  });

  it('does not consume the one-time attempt when StoreKit is unavailable', async () => {
    useUiPreferencesStore.setState({ completedSmartVerdicts: 2 });
    isAvailableMock.mockResolvedValue(false);

    await expect(reviewPromptService.requestWhenEligible()).resolves.toBe(false);
    expect(useUiPreferencesStore.getState().hasAttemptedReviewPrompt).toBe(false);
    expect(requestReviewMock).not.toHaveBeenCalled();
  });
});
