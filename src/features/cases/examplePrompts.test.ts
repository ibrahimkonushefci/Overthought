import { EXAMPLE_PROMPTS, pickExamplePrompts } from './examplePrompts';

describe('example prompts', () => {
  it('shows only prompts for the selected category', () => {
    const prompts = pickExamplePrompts('romance', 4, () => 0.42);
    const romancePrompts = EXAMPLE_PROMPTS.filter((prompt) => prompt.category === 'romance').map((prompt) => prompt.text);

    expect(romancePrompts).toHaveLength(5);
    expect(prompts).toHaveLength(4);
    expect(new Set(prompts).size).toBe(4);
    prompts.forEach((prompt) => {
      expect(romancePrompts).toContain(prompt);
    });
  });

  it('caps the requested count to the available prompt pool', () => {
    const prompts = pickExamplePrompts('friendship', 100, () => 0.1);
    const friendshipPrompts = EXAMPLE_PROMPTS.filter((prompt) => prompt.category === 'friendship');

    expect(prompts).toHaveLength(friendshipPrompts.length);
    expect(new Set(prompts).size).toBe(friendshipPrompts.length);
  });
});
