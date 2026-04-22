import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import type { CaseCategory } from '../../src/types/shared';
import { caseRepository } from '../../src/features/cases/repositories/caseRepository';
import { getCaseId } from '../../src/features/cases/types';
import { CategoryPill } from '../../src/features/cases/components/CategoryPill';
import { Button } from '../../src/shared/ui/Button';
import { AppText } from '../../src/shared/ui/Text';
import { Screen } from '../../src/shared/ui/Screen';
import { colors, radii, spacing, typography } from '../../src/shared/theme/tokens';
import { useGuestStore } from '../../src/store/guestStore';

const categories: CaseCategory[] = ['romance', 'friendship', 'social', 'general'];
const examples = [
  "She liked my story but replied after 9 hours.",
  "He said we should hang out sometime but did not set a date.",
  "My friend suddenly started texting more this week.",
  "They watched my story but did not react.",
];

export default function NewCaseRoute() {
  const router = useRouter();
  const draft = useGuestStore((state) => state.drafts.caseText);
  const preferredCategory = useGuestStore((state) => state.drafts.preferredCategory);
  const setCaseDraft = useGuestStore((state) => state.setCaseDraft);
  const setPreferredCategory = useGuestStore((state) => state.setPreferredCategory);
  const [inputText, setInputText] = useState(draft);
  const [category, setCategory] = useState<CaseCategory>(preferredCategory);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmed = inputText.trim();

    if (!trimmed) {
      Alert.alert('Add the situation', 'A sentence or two is enough.');
      return;
    }

    setLoading(true);
    try {
      const record = await caseRepository.createCase({ inputText: trimmed, category });
      router.replace(`/case/${getCaseId(record)}`);
    } catch (error) {
      Alert.alert('Could not save the case', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.text.primary} size={20} />
        </Pressable>
        <AppText variant="eyebrow">New case</AppText>
        <View style={styles.backButtonPlaceholder} />
      </View>
      <AppText variant="display">
        Spill the <AppText variant="display" color={colors.brand.pink} style={styles.script}>situation</AppText>.
      </AppText>
      <AppText variant="subtitle" style={styles.subtitle}>
        1-3 sentences. No essays. We will judge accordingly.
      </AppText>

      <View style={styles.categoryRow}>
        {categories.map((item) => (
          <CategoryPill
            key={item}
            category={item}
            selected={item === category}
            mode="category"
            onPress={() => {
              setCategory(item);
              setPreferredCategory(item);
            }}
          />
        ))}
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          multiline
          maxLength={400}
          onChangeText={(value) => {
            setInputText(value);
            setCaseDraft(value);
          }}
          placeholder="e.g. He said we should hang out but never picked a day..."
          placeholderTextColor={colors.ui.placeholder}
          style={styles.input}
          textAlignVertical="top"
          value={inputText}
        />
        <View style={styles.inputMeta}>
          <AppText variant="meta">{inputText.length}/400</AppText>
          <AppText variant="meta">{inputText.trim().length < 16 ? 'Keep going...' : 'Enough to judge.'}</AppText>
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
          title="Get the verdict"
          icon={Sparkles}
          loading={loading}
          disabled={loading || inputText.trim().length < 8}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});
