import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import type { CaseCategory } from '../src/types/shared';
import { aiVerdictService } from '../src/features/ai-verdict/aiVerdictService';
import { caseRepository } from '../src/features/cases/repositories/caseRepository';
import { pickExamplePrompts } from '../src/features/cases/examplePrompts';
import { getCaseId } from '../src/features/cases/types';
import { CategoryPill } from '../src/features/cases/components/CategoryPill';
import { Button } from '../src/shared/ui/Button';
import { AppText } from '../src/shared/ui/Text';
import { Screen } from '../src/shared/ui/Screen';
import { colors, radii, spacing, typography } from '../src/shared/theme/tokens';
import { assessCaseInputQuality } from '../src/shared/utils/caseInputQuality';
import { useAuthStore } from '../src/store/authStore';
import { useGuestStore } from '../src/store/guestStore';

const categories: CaseCategory[] = ['romance', 'friendship', 'social', 'general'];
const ANALYZING_DELAY_MS = 2000;
const MIN_CASE_CHARACTERS = 30;
const MIN_CASE_HELPER_COPY = "Give us at least 30 characters so there's enough drama to judge.";

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export default function NewCaseRoute() {
  const router = useRouter();
  const draft = useGuestStore((state) => state.drafts.caseText);
  const setCaseDraft = useGuestStore((state) => state.setCaseDraft);
  const sessionMode = useAuthStore((state) => state.sessionMode);
  const [inputText, setInputText] = useState(draft);
  const [category, setCategory] = useState<CaseCategory>('romance');
  const [loading, setLoading] = useState(false);
  const [examples, setExamples] = useState(() => pickExamplePrompts(4));
  const helperPulse = useRef(new Animated.Value(0)).current;
  const previousHelperAttentionKey = useRef('');
  const trimmedInput = inputText.trim();
  const inputQuality = assessCaseInputQuality(trimmedInput);
  const inputQualityBlocked = inputQuality.status === 'block';
  const canSubmit = !loading && trimmedInput.length >= MIN_CASE_CHARACTERS && !inputQualityBlocked;
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

  const submit = async () => {
    const trimmed = inputText.trim();

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
    setLoading(true);
    const minimumAnalyzingTime = wait(ANALYZING_DELAY_MS);

    try {
      const record = await caseRepository.createCase({ inputText: trimmed, category });
      const aiVerdictRequest = aiVerdictService.requestForCase(record);
      setCaseDraft('');
      setInputText('');
      setCategory('romance');
      setExamples(pickExamplePrompts(4));
      const [, aiResult] = await Promise.all([minimumAnalyzingTime, aiVerdictRequest]);
      const quotaParam = !aiResult.ok && aiResult.code === 'quota_exceeded' ? '&aiQuota=1' : '';
      router.push(`/case/${getCaseId(record)}?fromAnalysis=1${quotaParam}`);
    } catch (error) {
      Alert.alert('Could not save the case', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={styles.analyzingScreen}>
          <ActivityIndicator color={colors.brand.pink} size="large" />
          <AppText variant="display" center style={styles.analyzingTitle}>
            Getting the read...
          </AppText>
          <AppText variant="subtitle" center style={styles.analyzingSubtitle}>
            Trying Smart Verdict first. Basic Verdict is ready if it is unavailable.
          </AppText>
        </View>
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
      <View style={styles.aiAccessNote}>
        <Sparkles color={colors.text.secondary} size={15} strokeWidth={2.5} />
        <AppText variant="meta" color={colors.text.secondary} style={styles.aiAccessText}>
          {sessionMode === 'authenticated'
            ? 'Smart Verdicts run first when available: 2 free per day. Basic Verdict is the fallback.'
            : 'Guest trial includes 2 free Smart Verdicts. Sign in later for 2 Smart Verdicts per day.'}
        </AppText>
      </View>

      <View style={styles.categoryRow}>
        {categories.map((item) => (
          <CategoryPill
            key={item}
            category={item}
            selected={item === category}
            mode="category"
            onPress={() => setCategory(item)}
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

      <AppText variant="eyebrow" style={styles.examplesTitle}>
        Try one of these
      </AppText>
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

      <View style={styles.submitWrap}>
        <Button
          title="Judge this"
          icon={Sparkles}
          loading={loading}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </View>
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
  aiAccessNote: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  aiAccessText: {
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
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
  examplesTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    fontSize: 10,
    letterSpacing: 1.8,
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
    marginTop: spacing.xl,
  },
  analyzingScreen: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  analyzingTitle: {
    marginTop: spacing.md,
  },
  analyzingSubtitle: {
    maxWidth: 280,
  },
});
