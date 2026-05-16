import { EXAMPLE_PROMPTS, pickExamplePrompts } from './examplePrompts';

describe('example prompts', () => {
  it('keeps a larger pool while showing only four prompts', () => {
    const prompts = pickExamplePrompts(4, () => 0.42);

    expect(EXAMPLE_PROMPTS).toHaveLength(60);
    expect(prompts).toHaveLength(4);
    expect(new Set(prompts).size).toBe(4);
    prompts.forEach((prompt) => {
      expect(EXAMPLE_PROMPTS).toContain(prompt);
    });
  });

  it('caps the requested count to the available prompt pool', () => {
    const prompts = pickExamplePrompts(100, () => 0.1);

    expect(prompts).toHaveLength(EXAMPLE_PROMPTS.length);
    expect(new Set(prompts).size).toBe(EXAMPLE_PROMPTS.length);
  });
});
