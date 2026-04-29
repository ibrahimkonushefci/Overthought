import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { caseRepository } from '../../../../src/features/cases/repositories/caseRepository';
import { caseUpdateRepository } from '../../../../src/features/cases/repositories/caseUpdateRepository';
import type { CaseEntity } from '../../../../src/features/cases/types';
import { Screen } from '../../../../src/shared/ui/Screen';
import { AppText } from '../../../../src/shared/ui/Text';
import { Button } from '../../../../src/shared/ui/Button';
import { colors, radii, spacing, typography } from '../../../../src/shared/theme/tokens';
import { useGuestStore } from '../../../../src/store/guestStore';

export default function AddUpdateRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const draft = useGuestStore((state) => state.drafts.updateTextByCaseId[id] ?? '');
  const setUpdateDraft = useGuestStore((state) => state.setUpdateDraft);
  const [record, setRecord] = useState<CaseEntity | null>(null);
  const [text, setText] = useState(draft);
  const [loading, setLoading] = useState(false);

  const returnToCase = () => {
    router.replace(`/case/${id}`);
  };

  useEffect(() => {
    void caseRepository
      .getCase(id)
      .then(setRecord)
      .catch((error) => {
        Alert.alert('Could not load case', error instanceof Error ? error.message : 'Try again.');
      });
  }, [id]);

  const submit = async () => {
    const trimmed = text.trim();

    if (!trimmed) {
      Alert.alert('Add the update', 'A short update is enough.');
      return;
    }

    setLoading(true);

    try {
      await caseUpdateRepository.addUpdate(id, trimmed);
      setUpdateDraft(id, '');
      setText('');
      router.replace(`/case/${id}`);
    } catch (error) {
      Alert.alert('Could not add update', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={returnToCase} style={styles.backButton}>
          <ArrowLeft color={colors.text.primary} size={20} />
        </Pressable>
        <AppText variant="eyebrow">Add update</AppText>
        <View style={styles.backButtonPlaceholder} />
      </View>
      <AppText variant="display">
        What <AppText variant="display" color={colors.brand.pink} style={styles.script}>changed</AppText>?
      </AppText>
      {record ? (
        <AppText variant="subtitle" style={styles.subtitle} numberOfLines={2}>
          Updating: {record.title ?? record.inputText}
        </AppText>
      ) : null}

      <View style={styles.inputWrap}>
        <TextInput
          multiline
          maxLength={280}
          onChangeText={(value) => {
            setText(value);
            setUpdateDraft(id, value);
          }}
          placeholder="e.g. Now they actually picked a date..."
          placeholderTextColor={colors.ui.placeholder}
          style={styles.input}
          textAlignVertical="top"
          value={text}
        />
        <View style={styles.inputMeta}>
          <AppText variant="meta">{text.length}/280</AppText>
          <AppText variant="meta">{text.trim().length < 10 ? 'Add a little more.' : 'Ready.'}</AppText>
        </View>
      </View>

      <View style={styles.submitWrap}>
        <Button
          title={loading ? 'Updating...' : 'Update the verdict'}
          icon={Sparkles}
          loading={loading}
          disabled={loading || text.trim().length < 8}
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
  submitWrap: {
    marginTop: spacing.xl,
  },
});
