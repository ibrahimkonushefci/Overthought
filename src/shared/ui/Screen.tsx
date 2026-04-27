import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  bottomInset?: number;
  scrollResetKey?: string | number;
  initialScrollY?: number;
  onScrollYChange?: (scrollY: number) => void;
}

export function Screen({
  children,
  scroll = true,
  bottomInset = 132,
  scrollResetKey,
  initialScrollY = 0,
  onScrollYChange,
}: ScreenProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scroll && scrollResetKey !== undefined) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } else if (scroll && initialScrollY > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: initialScrollY, animated: false });
      });
    }
  }, [initialScrollY, scroll, scrollResetKey]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScrollYChange?.(event.nativeEvent.contentOffset.y);
  };

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.content, { paddingBottom: bottomInset }]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScrollYChange ? handleScroll : undefined}
        scrollEventThrottle={onScrollYChange ? 16 : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
});
