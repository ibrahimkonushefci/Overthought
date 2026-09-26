import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react-native';
import type { AiVerdictAccessState, AiVerdictResponse, CaseCategory } from '../src/types/shared';
import { caseRepository } from '../src/features/cases/repositories/caseRepository';
import { useExamplePrompts } from '../src/features/cases/useExamplePrompts';
import { getCaseId } from '../src/features/cases/types';
import { CategoryPill } from '../src/features/cases/components/CategoryPill';
import { VerdictRevealOverlay, type VerdictRevealOutcome } from '../src/features/cases/components/VerdictRevealOverlay';
import { SmartAllowanceStrip } from '../src/features/ai-verdict/components/SmartAllowanceStrip';
import { SmartVerdictLimitModal } from '../src/features/ai-verdict/components/SmartVerdictLimitModal';
import type { SmartLimitVariant } from '../src/features/ai-verdict/smartVerdictPresentation';
import { useSmartAllowance } from '../src/features/ai-verdict/useSmartAllowance';
import { Button } from '../src/shared/ui/Button';
import { AppText } from '../src/shared/ui/Text';
import { Screen } from '../src/shared/ui/Screen';
import { colors, radii, spacing, typography } from '../src/shared/theme/tokens';
import { assessCaseInputQuality } from '../src/shared/utils/caseInputQuality';
import {
  assessCaseSafety,
  CASE_SAFETY_MESSAGE,
  CaseSafetyRoutingError,
} from '../src/shared/utils/caseSafety';
import { useGuestStore } from '../src/store/guestStore';
import { reviewPromptService } from '../src/features/reviews/reviewPromptService';
import { trackEvent } from '../src/lib/analytics/analyticsService';

const categories: CaseCategory[] = ['romance', 'friendship', 'social', 'general'];
const MIN_REVEAL_DURATION_MS = 1600;
const MIN_CASE_CHARACTERS = 30;
const MIN_CASE_HELPER_COPY = "Give us at least 30 characters so there's enough drama to judge.";

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function revealOutcomeFromResult(aiResult: Extract<AiVerdictResponse, { ok: true }>): VerdictRevealOutcome {
  return {
    displayLabel: aiResult.verdict.displayLabel,
    score: aiResult.verdict.delusionScore,
    source: 'smart',
    verdictLabel: aiResult.verdict.verdictLabel,
  };
}

export default function NewCaseRoute() {
  const router = useRouter();
  const draft = useGuestStore((state) => state.drafts.caseText);
  const draftCategory = useGuestStore((state) => state.drafts.preferredCategory);
  const draftRequestId = useGuestStore((state) => state.drafts.caseRequestId);
  const setCaseDraft = useGuestStore((state) => state.setCaseDraft);
  const setPreferredCategory = useGuestStore((state) => state.setPreferredCategory);
  const clearCaseDraft = useGuestStore((state) => state.clearCaseDraft);
  const allowance = useSmartAllowance();
  const [inputText, setInputText] = useState(draft);
  const [category, setCategory] = useState<CaseCategory>(draftCategory);
  const [loading, setLoading] = useState(false);
  const [revealCategory, setRevealCategory] = useState<CaseCategory>('romance');
  const [revealOutcome, setRevealOutcome] = useState<VerdictRevealOutcome | null>(null);
  const [pendingResultRoute, setPendingResultRoute] = useState<string | null>(null);
  const { examples, refresh: refreshExamples } = useExamplePrompts(category, !loading);
  const [limitModal, setLimitModal] = useState<{
    variant: SmartLimitVariant;
    access: AiVerdictAccessState | null;
  } | null>(null);
  const helperPulse = useRef(new Animated.Value(0)).current;
  const previousHelperAttentionKey = useRef('');
  const trimmedInput = inputText.trim();
  const caseSafety = assessCaseSafety(trimmedInput);
  const inputQuality = assessCaseInputQuality(trimmedInput);
  const inputQualityBlocked = inputQuality.status === 'block';
  const canSubmit =
    !loading && (caseSafety.shouldRoute || (trimmedInput.length >= MIN_CASE_CHARACTERS && !inputQualityBlocked));
  const shouldShowInputQualityMessage =
    inputQualityBlocked || inputQuality.reason === 'too_vague' || inputQuality.reason === 'low_context';
  const shouldAnimateInputHelper = trimmedInput.length >= MIN_CASE_CHARACTERS && shouldShowInputQualityMessage;
  const helperAttentionKey = shouldAnimateInputHelper ? `${inputQuality.reason}:${inputQuality.message ?? ''}` : '';
  const inputHelperCopy =
    trimmedInput.length < MIN_CASE_CHARACTERS
      ? MIN_CASE_HELPER_COPY
      : shouldShowInputQualityMessage
        ? inputQuality.message ?? 'Add a clearer situation before judging.'
        : 'Enough to judge.';
  const helperAnimatedStyle = {
    transform: [
      {
        translateX: helperPulse.interpolate({
          inputRange: [0, 0.2, 0.45, 0.7, 1],
          outputRange: [0, -3, 3, -2, 0],
        }),
      },
      {
        scale: helperPulse.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.015, 1],
        }),
      },
    ],
  };

  useEffect(() => {
    if (!helperAttentionKey) {
      helperPulse.setValue(0);
      previousHelperAttentionKey.current = '';
      return;
    }

    if (previousHelperAttentionKey.current === helperAttentionKey) {
      return;
    }

    previousHelperAttentionKey.current = helperAttentionKey;
    helperPulse.setValue(0);
    Animated.timing(helperPulse, {
      toValue: 1,
      duration: 340,
      useNativeDriver: true,
    }).start();
  }, [helperAttentionKey, helperPulse]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/home');
  };

  const selectCategory = (nextCategory: CaseCategory) => {
    if (nextCategory === category) {
      refreshExamples();
      return;
    }
    setCategory(nextCategory);
    setPreferredCategory(nextCategory);
  };

  const showCreationFailure = (response: Extract<AiVerdictResponse, { ok: false }>) => {
    const retry = () => {
      trackEvent('smart_verdict_retry', { code: response.code });
      void submit();
    };
    const access = response.access;

    if (response.code === 'safety_routed') {
      Alert.alert('Your safety comes first', CASE_SAFETY_MESSAGE);
      return;
    }

    if (response.code === 'invalid_input') {
      Alert.alert('Check your case', response.message);
      return;
    }

    if (response.code === 'in_progress') {
      Alert.alert('Still working', 'Your Smart Verdict may still finish. Keep this draft and check again.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Check again', onPress: retry },
      ]);
      return;
    }

    if (response.code === 'quota_exceeded' && access?.accessTier === 'guest') {
      setLimitModal({ variant: 'guest', access });
      return;
    }

    if (response.code === 'quota_exceeded' && access?.accessTier === 'free') {
      setLimitModal({ variant: 'free', access });
      return;
    }

    if (response.code === 'fair_use_exceeded' || (access?.accessTier === 'premium' && access.reason === 'fair_use')) {
      setLimitModal({ variant: 'premium', access: access ?? null });
      return;
    }

    if (response.code === 'ip_daily_cap_exceeded' || response.code === 'global_daily_cap_exceeded') {
      setLimitModal({ variant: 'service', access: access ?? null });
      return;
    }

    if (response.code === 'not_authenticated') {
      Alert.alert('Sign in again', 'Your draft is saved. Sign in again before retrying.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth') },
      ]);
      return;
    }

    Alert.alert(
      'Smart Verdict not created',
      'An internet connection is required and no case was added. Your draft is saved.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Retry', onPress: retry },
      ],
    );
  };

  const submit = async () => {
    const trimmed = inputText.trim();

    if (assessCaseSafety(trimmed).shouldRoute) {
      Alert.alert('Your safety comes first', CASE_SAFETY_MESSAGE);
      return;
    }

    if (trimmed.length < MIN_CASE_CHARACTERS) {
      Alert.alert('Add a little more', MIN_CASE_HELPER_COPY);
      return;
    }

    const quality = assessCaseInputQuality(trimmed);

    if (quality.status === 'block') {
      Alert.alert('Make it a real case', quality.message ?? 'Add a clearer situation before judging.');
      return;
    }

    Keyboard.dismiss();
    setRevealCategory(category);
    setRevealOutcome(null);
    setPendingResultRoute(null);
    setLoading(true);
    const minimumRevealTime = wait(MIN_REVEAL_DURATION_MS);

    try {
      const requestId = useGuestStore.getState().ensureCaseRequestId();

      if (draftRequestId) {
        trackEvent('smart_verdict_retry', { code: 'preserved_request_id' });
      }
      const result = await caseRepository.createSmartCase({ requestId, inputText: trimmed, category });

      if (!result.ok) {
        setLoading(false);
        showCreationFailure(result.response);
        return;
      }

      await minimumRevealTime;
      reviewPromptService.recordSuccessfulSmartVerdict();
      clearCaseDraft();
      setInputText('');
      setCategory('romance');
      setPendingResultRoute(`/case/${getCaseId(result.record)}?fromAnalysis=1`);
      setRevealOutcome(revealOutcomeFromResult(result.response));
    } catch (error) {
      setRevealOutcome(null);
      setPendingResultRoute(null);
      setLoading(false);
      if (error instanceof CaseSafetyRoutingError) {
        Alert.alert('Your safety comes first', CASE_SAFETY_MESSAGE);
        return;
      }
      Alert.alert('Smart Verdict not created', 'Your draft is saved. Check your internet connection and retry.');
    }
  };

  const completeReveal = () => {
    if (!pendingResultRoute) {
      return;
    }

    router.push(pendingResultRoute);
    setLoading(false);
    setRevealOutcome(null);
    setPendingResultRoute(null);
  };

  if (loading) {
    return (
      <Screen bottomInset={0} scroll={false}>
        <VerdictRevealOverlay category={revealCategory} outcome={revealOutcome} onComplete={completeReveal} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.backButton}>
          <ArrowLeft color={colors.text.primary} size={20} />
        </Pressable>
        <AppText variant="eyebrow">New case</AppText>
        <View style={styles.backButtonPlaceholder} />
      </View>
      <AppText variant="display">
        Spill the <AppText variant="display" color={colors.brand.pink} style={styles.script}>situation</AppText>.
      </AppText>
      <AppText variant="subtitle" style={styles.subtitle}>
        A few details. No essay. We'll judge accordingly.
      </AppText>

      <View style={styles.categoryRow}>
        {categories.map((item) => (
          <CategoryPill
            key={item}
            category={item}
            selected={item === category}
            mode="category"
            onPress={() => selectCategory(item)}
          />
        ))}
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          autoCapitalize="sentences"
          autoCorrect
          multiline
          maxLength={400}
          onChangeText={(value) => {
            setInputText(value);
            setCaseDraft(value);
          }}
          placeholder="e.g. He said we should hang out but never picked a day..."
          placeholderTextColor={colors.ui.placeholder}
          spellCheck
          style={styles.input}
          textAlignVertical="top"
          textContentType="none"
          value={inputText}
        />
        <View style={styles.inputMeta}>
          <AppText variant="meta">{inputText.length}/400</AppText>
          <Animated.View style={[shouldAnimateInputHelper && styles.inputHelperCue, helperAnimatedStyle]}>
            <AppText
              variant="meta"
              color={shouldAnimateInputHelper ? colors.brand.pink : colors.text.secondary}
              style={styles.inputHelper}
            >
              {inputHelperCopy}
            </AppText>
          </Animated.View>
        </View>
      </View>

      <View style={styles.examplesHeader}>
        <AppText variant="eyebrow" style={styles.examplesTitle}>
          Try one of these
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show four more ideas"
          onPress={refreshExamples}
          style={styles.moreIdeas}
        >
          <RefreshCw color={colors.text.primary} size={14} />
          <AppText style={styles.moreIdeasText}>More ideas</AppText>
        </Pressable>
      </View>
      <View style={styles.examples}>
        {examples.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            onPress={() => {
              setInputText(item);
              setCaseDraft(item);
            }}
            style={styles.example}
          >
            <AppText variant="body" color={colors.text.secondary} style={styles.exampleText}>
              "{item}"
            </AppText>
          </Pressable>
        ))}
      </View>

      <SmartAllowanceStrip
        status={allowance.status}
        access={allowance.access}
        onSignIn={() => router.push('/auth')}
        onUpgrade={() => router.push('/paywall')}
      />

      <View style={styles.submitWrap}>
        <Button
          title="Judge this"
          icon={Sparkles}
          loading={loading}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </View>

      <SmartVerdictLimitModal
        visible={Boolean(limitModal)}
        variant={limitModal?.variant ?? 'service'}
        access={limitModal?.access}
        onDismiss={() => setLimitModal(null)}
        onPrimary={() => {
          const variant = limitModal?.variant;
          setLimitModal(null);
          if (variant === 'guest') {
            router.push('/auth');
          } else if (variant === 'free') {
            router.push('/paywall');
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backButtonPlaceholder: {
    height: 40,
    width: 40,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  subtitle: {
    marginTop: spacing.md,
    fontFamily: typography.family.body,
    fontSize: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  inputWrap: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    minHeight: 158,
    padding: spacing.md,
  },
  input: {
    color: colors.text.primary,
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 102,
  },
  inputMeta: {
    gap: spacing.md,
  },
  inputHelper: {
    lineHeight: 16,
  },
  inputHelperCue: {
    backgroundColor: 'rgba(236, 41, 141, 0.08)',
    borderRadius: radii.sm,
    marginLeft: -spacing.xs,
    marginTop: -spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  examplesHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  examplesTitle: {
    fontSize: 10,
    letterSpacing: 1.8,
  },
  moreIdeas: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  moreIdeasText: {
    fontFamily: typography.family.bodySemiBold,
    fontSize: 13,
  },
  examples: {
    gap: spacing.sm,
  },
  example: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  exampleText: {
    fontFamily: typography.family.body,
    fontSize: 13,
    lineHeight: 18,
  },
  submitWrap: {
    marginTop: spacing.md,
  },
});
