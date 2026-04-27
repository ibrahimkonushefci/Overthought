import { analyzeCase, verdictConfig } from './index';
import type { Category } from './types';

interface GoldenCase {
  name: string;
  category: Category;
  inputText: string;
  minScore: number;
  maxScore: number;
  verdictLabel:
    | 'barely_delusional'
    | 'slight_reach'
    | 'mild_delusion'
    | 'dangerous_overthinking'
    | 'full_clown_territory';
  explanationPattern: RegExp;
}

const goldenCases: GoldenCase[] = [
  {
    name: 'The Ghost Town',
    category: 'romance',
    inputText:
      "He liked my Instagram story from three weeks ago, but he hasn't texted me back since we matched.",
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /digital crumbs|thumb slip|not romance/i,
  },
  {
    name: 'The Green Flag',
    category: 'romance',
    inputText:
      "She texted me 'I had a great time, let's get dinner on Friday' and she actually booked the reservation.",
    minScore: 0,
    maxScore: 12,
    verdictLabel: 'barely_delusional',
    explanationPattern: /booked|logistics|guaranteed date|opening this app/i,
  },
  {
    name: 'The Polite Flake',
    category: 'friendship',
    inputText:
      "I asked if they wanted to hang out and they just replied 'maybe sometime next week haha' and never texted again.",
    minScore: 80,
    maxScore: 85,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /maybe sometime|let this conversation die|peacefully/i,
  },
  {
    name: 'The Main Character',
    category: 'social',
    inputText:
      'Everyone at the party was looking at me, I think this must mean they all want to be my best friend.',
    minScore: 86,
    maxScore: 95,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /main character|on fire|best friend/i,
  },
  {
    name: 'The Good Coworker',
    category: 'general',
    inputText: 'My coworker checks in every morning and always asks how my current project is going.',
    minScore: 40,
    maxScore: 50,
    verdictLabel: 'mild_delusion',
    explanationPattern: /bonus|project|micromanagement|meet-cute/i,
  },
  {
    name: 'The Hot and Cold',
    category: 'romance',
    inputText:
      "He texts me every single day without fail, but whenever I ask to hang out in person he says he's really busy with work right now.",
    minScore: 80,
    maxScore: 85,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /emotional support chatbot|time for coffee|don't want to/i,
  },
  {
    name: 'The HR Violation',
    category: 'romance',
    inputText:
      'My manager always buys me coffee when we have our 1-on-1 meetings and smiles at me a lot. Does this mean they are into me?',
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /corporate card|courtship|iced latte|boss/i,
  },
  {
    name: 'The Secure Attachment',
    category: 'friendship',
    inputText:
      'My best friend left me on read for two days after I sent them a TikTok. Are we no longer friends?',
    minScore: 75,
    maxScore: 85,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /tiktok|court summons|48 hours|touch grass/i,
  },
  {
    name: 'The Slow Burn',
    category: 'romance',
    inputText:
      "She remembered my dog's birthday and asked about him, but it took her 14 hours to reply to my last text.",
    minScore: 60,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /dog|golden retriever|middleman|animal/i,
  },
  {
    name: 'The Crowd Control',
    category: 'social',
    inputText:
      'He invited me to his birthday party, but he invited the entire office, so I think he really wants me there.',
    minScore: 86,
    maxScore: 92,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /not exclusively chosen|warm body|free cake|targeted strike/i,
  },
];

const goldenResults: Array<{
  name: string;
  score: number;
  verdict: string;
  read: string;
}> = [];

describe('verdict engine golden cases', () => {
  afterAll(() => {
    console.table(goldenResults);
  });

  it.each(goldenCases)('$name lands on the calibrated score and voice', (goldenCase) => {
    const result = analyzeCase(verdictConfig, {
      category: goldenCase.category,
      inputText: goldenCase.inputText,
    });

    goldenResults.push({
      name: goldenCase.name,
      score: result.delusionScore,
      verdict: result.verdictLabel,
      read: result.explanationText,
    });

    expect(result.delusionScore).toBeGreaterThanOrEqual(goldenCase.minScore);
    expect(result.delusionScore).toBeLessThanOrEqual(goldenCase.maxScore);
    expect(result.verdictLabel).toBe(goldenCase.verdictLabel);
    expect(result.explanationText).toMatch(goldenCase.explanationPattern);
    expect(result.explanationText).not.toMatch(/Main reasons:/i);
  });
});
