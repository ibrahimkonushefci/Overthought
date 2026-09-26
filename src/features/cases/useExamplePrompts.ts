import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { CaseCategory } from '../../types/shared';
import { appStorage } from '../../storage/mmkv';
import { createExamplePromptRotation, scheduleExamplePromptRefresh } from './examplePromptRotation';

const rotation = createExamplePromptRotation(appStorage);

export function useExamplePrompts(category: CaseCategory, visible = true) {
  const [examples, setExamples] = useState<string[]>([]);
  const refresh = useCallback(() => setExamples(rotation.next(category)), [category]);

  useFocusEffect(useCallback(() => {
    if (visible) return scheduleExamplePromptRefresh(refresh);
  }, [refresh, visible]));

  return { examples, refresh };
}
