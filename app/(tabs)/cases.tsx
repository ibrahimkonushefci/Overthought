import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Archive, Search } from 'lucide-react-native';
import type { CaseCategory } from '../../src/types/shared';
import { Screen } from '../../src/shared/ui/Screen';
import { AppText } from '../../src/shared/ui/Text';
import { EmptyState } from '../../src/shared/ui/EmptyState';
import { CaseCard } from '../../src/features/cases/components/CaseCard';
import { CategoryPill } from '../../src/features/cases/components/CategoryPill';
import { useCases } from '../../src/features/cases/services/useCases';
import { categoryLabels } from '../../src/shared/utils/verdict';
import { colors, radii, spacing, typography } from '../../src/shared/theme/tokens';

type Filter = CaseCategory | 'all';
const filters: Filter[] = ['all', 'romance', 'friendship', 'social', 'general'];

export default function CasesRoute() {
  const router = useRouter();
  const { cases } = useCases();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const hasFocusedOnceRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }

      setFilter('all');
    }, []),
  );

  const visibleCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cases.filter((item) => {
      const matchesFilter = filter === 'all' || item.category === filter;
      const haystack = `${item.title ?? ''} ${item.inputText} ${item.verdictLabel}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [cases, filter, query]);
  const hasQuery = query.trim().length > 0;
  const hasFilter = filter !== 'all';
  const noMatchTitle =
    hasQuery && hasFilter
      ? 'Nothing matches these filters.'
      : hasQuery
        ? 'No case matches that search.'
        : `No ${categoryLabels[filter as CaseCategory]} cases yet.`;
  const noMatchBody =
    hasQuery && hasFilter
      ? 'The archive is here. These filters are doing too much.'
      : hasQuery
        ? 'Try a different term or clear the search.'
        : 'The archive has drama, just not in this category.';
  const noMatchActionLabel = hasQuery && hasFilter ? 'Reset' : hasQuery ? 'Clear search' : 'Show all cases';
  const resetNoMatch = () => {
    if (hasQuery) {
      setQuery('');
    }

    if (hasFilter) {
      setFilter('all');
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="eyebrow">Cases</AppText>
        <AppText variant="display">
          Your <AppText variant="display" color={colors.brand.pink} style={styles.script}>case file</AppText>.
        </AppText>
      </View>

      <View style={styles.search}>
        <Search color={colors.text.secondary} size={20} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search cases..."
          placeholderTextColor={colors.ui.placeholder}
          returnKeyType="search"
          style={styles.searchInput}
          submitBehavior="blurAndSubmit"
          value={query}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroller}
      >
        {filters.map((item) => (
          <CategoryPill key={item} category={item} selected={filter === item} onPress={() => setFilter(item)} />
        ))}
      </ScrollView>

      {visibleCases.length > 0 ? (
        <View style={styles.list}>
          {visibleCases.map((item) => (
            <CaseCard key={'localId' in item ? item.localId : item.id} item={item} />
          ))}
        </View>
      ) : cases.length === 0 ? (
        <EmptyState
          title="Your archive is suspiciously empty."
          body="Add your first case to get started."
          emoji="📭"
          icon={Archive}
          actionLabel="Create a case"
          onAction={() => router.push('/new-case')}
        />
      ) : (
        <EmptyState
          title={noMatchTitle}
          body={noMatchBody}
          emoji="🔎"
          icon={Search}
          actionLabel={noMatchActionLabel}
          onAction={resetNoMatch}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  script: {
    fontFamily: typography.family.editorial,
  },
  search: {
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderColor: colors.ui.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    color: colors.text.primary,
    flex: 1,
    fontFamily: typography.family.bodyMedium,
    fontSize: 15,
  },
  filterScroller: {
    flexGrow: 0,
    height: 32,
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
    maxHeight: 32,
    overflow: 'visible',
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
});
