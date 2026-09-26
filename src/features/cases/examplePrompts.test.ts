import { EXAMPLE_PROMPTS } from './examplePrompts';
import { assessCaseInputQuality } from '../../shared/utils/caseInputQuality';
import { assessCaseSafety } from '../../shared/utils/caseSafety';

describe('example prompt catalog', () => {
  it('provides sixteen distinct situations for each category with unique stable IDs', () => {
    expect(EXAMPLE_PROMPTS).toHaveLength(64);
    expect(new Set(EXAMPLE_PROMPTS.map((prompt) => prompt.id)).size).toBe(64);
    expect(new Set(EXAMPLE_PROMPTS.map((prompt) => prompt.text)).size).toBe(64);
    for (const category of ['romance', 'friendship', 'social', 'general']) {
      expect(EXAMPLE_PROMPTS.filter((prompt) => prompt.category === category)).toHaveLength(16);
    }
  });

  it.each(EXAMPLE_PROMPTS)('$id is usable directly without input-quality or safety warnings', ({ text }) => {
    expect(text.length).toBeGreaterThanOrEqual(30);
    expect(text.length).toBeLessThanOrEqual(400);
    expect(assessCaseInputQuality(text).status).toBe('ok');
    expect(assessCaseSafety(text).shouldRoute).toBe(false);
  });
});
