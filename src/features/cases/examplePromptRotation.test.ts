import type { CaseCategory } from '../../types/shared';
import { EXAMPLE_PROMPTS, EXAMPLE_PROMPT_CATALOG_VERSION } from './examplePrompts';
import { createExamplePromptRotation, EXAMPLE_PROMPT_STORAGE_KEY, scheduleExamplePromptRefresh } from './examplePromptRotation';

function memoryStorage(initial?: string) {
  let value = initial;
  return {
    getString: jest.fn(() => value),
    set: jest.fn((_key: string, next: string) => { value = next; }),
  };
}

describe('remembered example rotation', () => {
  it.each<CaseCategory>(['romance', 'friendship', 'social', 'general'])('cycles through %s without repetition or overlapping cycle boundaries', (category) => {
    const rotation = createExamplePromptRotation(memoryStorage());
    const pool = EXAMPLE_PROMPTS.filter((prompt) => prompt.category === category).map((prompt) => prompt.text);
    let previous: string[] = [];
    const seen: string[] = [];
    for (let group = 0; group < 160; group += 1) {
      const next = rotation.next(category);
      expect(next).toHaveLength(3);
      expect(new Set(next).size).toBe(3);
      expect(next.some((text) => previous.includes(text))).toBe(false);
      next.forEach((text) => expect(pool).toContain(text));
      seen.push(...next);
      previous = next;
    }
    for (let offset = 0; offset < seen.length; offset += 16) {
      expect(new Set(seen.slice(offset, offset + 16)).size).toBe(16);
    }
  });

  it('remembers progress across service restarts and keeps categories independent', () => {
    const storage = memoryStorage();
    let rotation = createExamplePromptRotation(storage, () => 0.42);
    const first = rotation.next('romance');
    const before = JSON.parse(storage.getString()!).categories.romance;
    rotation.next('social');
    expect(JSON.parse(storage.getString()!).categories.romance).toEqual(before);
    rotation = createExamplePromptRotation(storage, () => 0.42);
    const rest = Array.from({ length: 5 }, () => {
      rotation = createExamplePromptRotation(storage, () => 0.42);
      return rotation.next('romance');
    }).flat();
    expect(new Set([...first, ...rest].slice(0, 16)).size).toBe(16);
    expect(storage.set).toHaveBeenCalledWith(EXAMPLE_PROMPT_STORAGE_KEY, expect.any(String));
    const stored = JSON.parse(storage.getString()!);
    expect(stored.version).toBe(EXAMPLE_PROMPT_CATALOG_VERSION);
    expect(Object.keys(stored).sort()).toEqual(['categories', 'version']);
    expect(JSON.stringify(stored)).not.toContain(first[0]);
  });

  it.each([
    'not json', 'null', '{}',
    JSON.stringify({ version: 0, categories: {} }),
    JSON.stringify({ version: 1, categories: [] }),
    JSON.stringify({ version: 1, categories: { unknown: {} } }),
    JSON.stringify({ version: 1, categories: { romance: { remaining: null, previous: [] } } }),
    JSON.stringify({ version: 1, categories: { romance: { remaining: [], previous: ['deleted', 'romance-01', 'romance-02', 'romance-03'] } } }),
    JSON.stringify({ version: 1, categories: { romance: { remaining: ['romance-01', 'romance-02', 'romance-03', 'romance-04'], previous: ['romance-01', 'romance-02', 'romance-03', 'romance-04'] } } }),
    JSON.stringify({ version: 1, categories: { romance: { remaining: [], previous: ['social-01', 'social-02', 'social-03', 'social-04'] } } }),
  ])('recovers safely from malformed or stale rotation state: %s', (initial) => {
    const rotation = createExamplePromptRotation(memoryStorage(initial));
    const cycle = Array.from({ length: 6 }, () => rotation.next('romance')).flat();
    expect(new Set(cycle.slice(0, 16)).size).toBe(16);
  });

  it('continues in memory when storage cannot be read or written', () => {
    const storage = { getString: () => { throw new Error('unavailable'); }, set: () => { throw new Error('unavailable'); } };
    const rotation = createExamplePromptRotation(storage);
    expect(new Set(Array.from({ length: 6 }, () => rotation.next('general')).flat().slice(0, 16)).size).toBe(16);
  });

  it('does not advance during initialization or consume canceled focus effects', async () => {
    const storage = memoryStorage();
    const rotation = createExamplePromptRotation(storage);
    expect(storage.getString).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    const show = jest.fn(() => rotation.next('romance'));
    const cancel = scheduleExamplePromptRefresh(show);
    cancel();
    const blur = scheduleExamplePromptRefresh(show);
    await Promise.resolve();
    expect(show).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledTimes(1);
    blur();
    scheduleExamplePromptRefresh(show);
    await Promise.resolve();
    expect(show).toHaveBeenCalledTimes(2);
    expect(new Set(show.mock.results.flatMap((result) => result.value)).size).toBe(6);
  });
});
