import type { CaseCategory } from '../../types/shared';
import { EXAMPLE_PROMPTS, EXAMPLE_PROMPT_BATCH_SIZE, EXAMPLE_PROMPT_CATALOG_VERSION } from './examplePrompts';

export const EXAMPLE_PROMPT_STORAGE_KEY = 'overthought-example-prompt-rotation';
const categories: CaseCategory[] = ['romance', 'friendship', 'social', 'general'];

interface CategoryRotation {
  remaining: string[];
  previous: string[];
}

interface RotationState {
  version: number;
  categories: Partial<Record<CaseCategory, CategoryRotation>>;
}

interface RotationStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

function emptyState(): RotationState {
  return { version: EXAMPLE_PROMPT_CATALOG_VERSION, categories: {} };
}

function readState(storage: RotationStorage): RotationState {
  try {
    const value = JSON.parse(storage.getString(EXAMPLE_PROMPT_STORAGE_KEY) ?? 'null');
    if (!value || value.version !== EXAMPLE_PROMPT_CATALOG_VERSION || !value.categories ||
      typeof value.categories !== 'object' || Array.isArray(value.categories)) return emptyState();

    for (const [category, entry] of Object.entries(value.categories)) {
      if (!categories.includes(category as CaseCategory) || !entry || typeof entry !== 'object') return emptyState();
      const { remaining, previous } = entry as CategoryRotation;
      const ids = EXAMPLE_PROMPTS.filter((prompt) => prompt.category === category).map((prompt) => prompt.id);
      if (!Array.isArray(remaining) || !Array.isArray(previous) || previous.length !== EXAMPLE_PROMPT_BATCH_SIZE ||
        remaining.length >= ids.length ||
        [...remaining, ...previous].some((id) => typeof id !== 'string' || !ids.includes(id)) ||
        new Set(remaining).size !== remaining.length || new Set(previous).size !== previous.length) return emptyState();
    }
    return value as RotationState;
  } catch {
    return emptyState();
  }
}

export function createExamplePromptRotation(storage: RotationStorage, random: () => number = Math.random) {
  let state: RotationState | undefined;

  function shuffle(ids: string[]): string[] {
    const result = [...ids];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  return {
    next(category: CaseCategory): string[] {
      state ??= readState(storage);
      const pool = EXAMPLE_PROMPTS.filter((prompt) => prompt.category === category);
      const rotation = state.categories[category] ?? { remaining: [], previous: [] };
      const next: string[] = [];
      while (next.length < EXAMPLE_PROMPT_BATCH_SIZE) {
        if (rotation.remaining.length === 0) {
          // A batch may straddle cycles when the catalog size is not divisible
          // by the batch size. Keep two opening groups clear of the old
          // visible group and the tail carried into this batch.
          const first = shuffle(pool.map((prompt) => prompt.id).filter((id) =>
            !rotation.previous.includes(id) && !next.includes(id)))
            .slice(0, EXAMPLE_PROMPT_BATCH_SIZE * 2);
          rotation.remaining = [...first, ...shuffle(pool.map((prompt) => prompt.id).filter((id) => !first.includes(id)))];
        }
        next.push(...rotation.remaining.splice(0, EXAMPLE_PROMPT_BATCH_SIZE - next.length));
      }
      rotation.previous = next;
      state.categories[category] = rotation;
      try {
        storage.set(EXAMPLE_PROMPT_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Suggestions remain usable and continue rotating in memory if storage fails.
      }
      return rotation.previous.map((id) => pool.find((prompt) => prompt.id === id)!.text);
    },
  };
}

// Defer until the focus effect settles, so a canceled navigation or React's
// development effect replay does not consume a group that was never displayed.
export function scheduleExamplePromptRefresh(refresh: () => void): () => void {
  let active = true;
  void Promise.resolve().then(() => {
    if (active) refresh();
  });
  return () => { active = false; };
}
