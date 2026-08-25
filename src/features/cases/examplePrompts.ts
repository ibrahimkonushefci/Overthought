import type { CaseCategory } from '../../types/shared';

export interface ExamplePrompt {
  category: CaseCategory;
  text: string;
}

export const EXAMPLE_PROMPTS: readonly ExamplePrompt[] = [
  { category: 'romance', text: 'He asked if I was free Friday, then never made a plan.' },
  { category: 'romance', text: 'He watches every story but takes a day to reply.' },
  { category: 'romance', text: 'My ex came back saying he misses me but still avoids commitment.' },
  { category: 'romance', text: 'We had a great date, but his dating profile is still active.' },
  { category: 'romance', text: 'He says he likes me, but only texts after 11 p.m.' },
  { category: 'friendship', text: 'My best friend left me on read for two days but keeps posting.' },
  { category: 'friendship', text: 'My friend keeps canceling plans but says everything is fine.' },
  { category: 'friendship', text: 'They are warm in person but suddenly dry in our messages.' },
  { category: 'friendship', text: 'My friend stopped initiating but still replies right away.' },
  { category: 'friendship', text: 'The group chat went quiet right after I joined the conversation.' },
  { category: 'social', text: 'They added me to Close Friends but never talk to me directly.' },
  { category: 'social', text: 'My coworker checks in every morning and always uses heart emojis.' },
  { category: 'social', text: 'They laughed at every joke I made during the meeting.' },
  { category: 'social', text: 'Someone keeps standing near me at the gym but never says hello.' },
  { category: 'social', text: 'They followed me back immediately but have not sent a message.' },
  { category: 'general', text: 'My roommate was unusually quiet this morning. Are they mad at me?' },
  { category: 'general', text: 'My manager said we need to talk tomorrow without explaining why.' },
  { category: 'general', text: 'Someone replied “sure” and now I cannot tell if they are annoyed.' },
  { category: 'general', text: 'I made one awkward comment and keep replaying it hours later.' },
  { category: 'general', text: 'They changed the plan at the last minute and I think it was personal.' },
];

export function pickExamplePrompts(
  category: CaseCategory,
  count = 4,
  random: () => number = Math.random,
): string[] {
  const pool = EXAMPLE_PROMPTS.filter((prompt) => prompt.category === category).map((prompt) => prompt.text);

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    const swapIndex = Math.min(index, Math.max(0, randomIndex));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, Math.min(count, pool.length));
}
