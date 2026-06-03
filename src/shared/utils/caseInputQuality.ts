export type CaseInputQualityStatus = 'ok' | 'block' | 'needs_context';

export type CaseInputQualityReason =
  | 'ok'
  | 'emoji_or_symbols_only'
  | 'repeated_characters'
  | 'repeated_words'
  | 'keyboard_gibberish'
  | 'random_words'
  | 'not_a_case'
  | 'too_vague'
  | 'unsupported_local_language'
  | 'low_context';

export interface CaseInputQualityAssessment {
  status: CaseInputQualityStatus;
  reason: CaseInputQualityReason;
  message: string | null;
}

const BLOCK_MESSAGES: Partial<Record<CaseInputQualityReason, string>> = {
  emoji_or_symbols_only: 'I need words, not just vibes. Add the situation so I can judge the drama properly.',
  repeated_characters: 'Give me a real situation, not keyboard soup. Who did what, and what are you worried it means?',
  repeated_words: 'This is looping harder than your Notes app. Add what happened and what you want judged.',
  keyboard_gibberish: 'Give me a real situation, not keyboard soup. Who did what, and what are you worried it means?',
  random_words: 'This reads like fridge magnets, not a case file. Add the human drama.',
  not_a_case:
    'Overthought judges social situations, not homework, poems, or financial prophecy. Bring me a human being doing something confusing.',
};

const NEEDS_CONTEXT_MESSAGES: Partial<Record<CaseInputQualityReason, string>> = {
  too_vague: 'I can see the spiral, but not the receipts. Add who did what and what you think it means.',
  unsupported_local_language:
    'Smart Verdict may understand this, but Basic Verdict needs clearer social details to avoid fake confidence.',
  low_context: 'This is not a judgeable case yet. Add one clear event, who did what, and what you think it means.',
};

const RANDOM_OBJECT_WORDS = new Set([
  'airplane',
  'airport',
  'banana',
  'bitcoin',
  'broccoli',
  'candle',
  'carpet',
  'chair',
  'coffee',
  'dog',
  'france',
  'garden',
  'lamp',
  'mirror',
  'moon',
  'paper',
  'photosynthesis',
  'pizza',
  'turtle',
  'wallet',
  'window',
]);

const FINANCE_ASSET_WORDS = new Set([
  'bitcoin',
  'btc',
  'coin',
  'crypto',
  'ethereum',
  'eth',
  'sol',
  'solana',
  'token',
]);

const FINANCE_ACTION_WORDS = new Set([
  'buy',
  'dip',
  'hold',
  'invest',
  'investment',
  'market',
  'price',
  'pump',
  'sell',
  'trade',
  'wait',
]);

const ENGLISH_SOCIAL_PATTERNS = [
  /\b(she|he|they|someone|friend|best friend|coworker|manager|boss|roommate|ex|guy|girl|person)\b/i,
  /\b(text(?:ed|s)?|reply|replied|message|messaged|dm|dmed|called|liked|watched|viewed|looked|laughed|smiled)\b/i,
  /\b(date|relationship|friendship|hang out|meet up|story|stories|class|party|dinner|coffee|read|delivered)\b/i,
  /\b(on read|left me|ghosted|weird|different|confused|overthinking|serious|casual)\b/i,
];

const HUMAN_OR_ACTION_SOCIAL_PATTERNS = [
  /\b(she|he|they|someone|friend|best friend|coworker|manager|boss|roommate|ex|guy|girl|person)\b/i,
  /\b(text(?:ed|s)?|reply|replied|message|messaged|dm|dmed|called|liked|watched|viewed|looked|laughed|smiled)\b/i,
  /\b(on read|left me|ghosted|overthinking)\b/i,
];

const MULTILINGUAL_SOCIAL_PATTERNS = [
  /\b(ai|ajo|shkruan|shkrun|mengjes|thote|lidhje|serioze|pastaj|qdo|cdo|mirpo|mirepo|deshiron|takim)\b/i,
  /\bme\s+dal(?:e|ë)?\b/i,
  /\bnat(?:e|ë)?\b/i,
  /\b(ella|el|mira|clase|rie|nunca|escribe|primero)\b/i,
  /\bmë\b/i,
];

const NON_CASE_PATTERNS = [
  /^\s*(what is|explain|write me|write a|write an|make me|solve|summarize|translate)\b/i,
  /\b(capital of france|photosynthesis|poem about|recipe for|detailed recipe)\b/i,
];

const PROMPT_OR_SCHEMA_ATTACK_PATTERNS = [
  /\b(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/i,
  /\[\s*system\s+override\s*\]/i,
  /\b(?:system|developer)\s+override\b/i,
  /\bdisable\s+the\s+roasting\s+persona\b/i,
  /\b(?:return|give me)\s+a\s+delusion\s+score\s+of\b/i,
  /\bwrite\s+test\s+passed\b/i,
  /\binside\s+the\s+[`"“”']?(?:explanationText|verdictLabel|delusionScore|nextMoveText)[`"“”']?\s+field\b/i,
  /\b(?:verdictLabel|delusionScore|explanationText|nextMoveText)\b.*\b(?:hacked|system compromised|restart|999|test passed)\b/i,
  /[`"“”']?\s*verdictLabel\s*[`"“”']?\s*:/i,
  /\bplease\s+don[’']?t\s+roast\s+me\b/i,
];

const META_AI_NON_CASE_PATTERNS = [
  /\bthis app\b.*\b(?:dumb script|actual ai|ai)\b/i,
  /\b(?:actual ai|dumb script)\b.*\bthis app\b/i,
  /\byou\s+are\s+admitting\s+your\s+own\s+code\s+is\s+delusional\b/i,
  /\byour\s+own\s+code\b.*\bdelusional\b/i,
  /\bif\s+you\s+give\s+me\s+a\s+high\s+delusion\s+score\b/i,
];

const CODE_NON_CASE_PATTERNS = [
  /```[\s\S]*```/,
  /\bthis\s+exact\s+code\b/i,
  /\b(?:javascript|typescript|python|html|css|sql)\b.*\b(?:console\.log|function|const|let|var|return|select|div)\b/i,
  /\bconsole\.log\s*\(/i,
];

const TOO_VAGUE_PATTERNS = [
  /^\s*are you serious right now(?:\s+bro)?\??\s*$/i,
  /\blooked at me\b.*\bi think\b/i,
  /\bis weird\b.*\bi (?:do not|don[’']?t|dont) know\b/i,
  /\bacted different today\b/i,
  /\bsomeone texted me\b.*\boverthinking\b/i,
];

function wordTokens(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

function compactCharacters(value: string): string {
  return value.replace(/\s+/g, '');
}

function letterOrNumberCount(value: string): number {
  return value.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

function hasAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function hasSocialContext(value: string): boolean {
  return hasAnyPattern(value, ENGLISH_SOCIAL_PATTERNS) || hasAnyPattern(value, MULTILINGUAL_SOCIAL_PATTERNS);
}

function hasHumanOrActionSocialContext(value: string): boolean {
  return hasAnyPattern(value, HUMAN_OR_ACTION_SOCIAL_PATTERNS) || hasAnyPattern(value, MULTILINGUAL_SOCIAL_PATTERNS);
}

function hasMultilingualSocialContext(value: string): boolean {
  return hasAnyPattern(value, MULTILINGUAL_SOCIAL_PATTERNS);
}

function hasNonAsciiLetters(value: string): boolean {
  return [...value].some((character) => character.charCodeAt(0) > 127 && /\p{L}/u.test(character));
}

function isRepeatedCharacters(value: string): boolean {
  const compact = compactCharacters(value).toLowerCase();

  if (compact.length < 16) {
    return false;
  }

  const uniqueCharacters = new Set([...compact]);

  if (uniqueCharacters.size <= 2) {
    return true;
  }

  return /(.)\1{14,}/u.test(compact);
}

function isRepeatedWords(words: string[]): boolean {
  if (words.length < 6) {
    return false;
  }

  const counts = new Map<string, number>();
  words.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  const maxCount = Math.max(...counts.values());
  const uniqueRatio = counts.size / words.length;

  return maxCount >= 5 || uniqueRatio <= 0.35;
}

function isKeyboardGibberish(words: string[]): boolean {
  if (words.length === 0) {
    return false;
  }

  const keyboardishWords = words.filter((word) =>
    word.length >= 4 &&
    (/(asd|qwe|zxc|jkl|hfhf|fhfh|kj|sdj|jhs)/i.test(word) ||
      (word.length >= 8 && !/[aeiouy]/i.test(word))),
  );

  return keyboardishWords.length >= 2 || (words.length <= 3 && keyboardishWords.some((word) => word.length >= 12));
}

function isRandomWordPile(words: string[], value: string): boolean {
  if (words.length < 5 || hasHumanOrActionSocialContext(value)) {
    return false;
  }

  const randomWordCount = words.filter((word) => RANDOM_OBJECT_WORDS.has(word)).length;
  return randomWordCount >= 4 && randomWordCount / words.length >= 0.65;
}

function isFinancePrompt(words: string[], value: string): boolean {
  const hasFinanceAsset = words.some((word) => FINANCE_ASSET_WORDS.has(word));
  const hasFinanceAction =
    words.some((word) => FINANCE_ACTION_WORDS.has(word)) || /\blooks?\s+good\s+(?:here\s+)?to\s+buy\b/i.test(value);

  return hasFinanceAsset && hasFinanceAction && !hasSocialContext(value);
}

function isObviousNonCase(value: string): boolean {
  return (
    hasAnyPattern(value, PROMPT_OR_SCHEMA_ATTACK_PATTERNS) ||
    hasAnyPattern(value, META_AI_NON_CASE_PATTERNS) ||
    hasAnyPattern(value, CODE_NON_CASE_PATTERNS) ||
    (hasAnyPattern(value, NON_CASE_PATTERNS) && !hasSocialContext(value))
  );
}

function messageFor(reason: CaseInputQualityReason): string | null {
  return BLOCK_MESSAGES[reason] ?? NEEDS_CONTEXT_MESSAGES[reason] ?? null;
}

export function assessCaseInputQuality(inputText: string): CaseInputQualityAssessment {
  const trimmed = inputText.trim();
  const words = wordTokens(trimmed);
  const letterNumberCount = letterOrNumberCount(trimmed);

  if (trimmed.length >= 8 && letterNumberCount === 0) {
    return { status: 'block', reason: 'emoji_or_symbols_only', message: messageFor('emoji_or_symbols_only') };
  }

  if (isRepeatedCharacters(trimmed)) {
    return { status: 'block', reason: 'repeated_characters', message: messageFor('repeated_characters') };
  }

  if (isRepeatedWords(words)) {
    return { status: 'block', reason: 'repeated_words', message: messageFor('repeated_words') };
  }

  if (isKeyboardGibberish(words)) {
    return { status: 'block', reason: 'keyboard_gibberish', message: messageFor('keyboard_gibberish') };
  }

  if (isRandomWordPile(words, trimmed)) {
    return { status: 'block', reason: 'random_words', message: messageFor('random_words') };
  }

  if (isFinancePrompt(words, trimmed)) {
    return { status: 'block', reason: 'not_a_case', message: messageFor('not_a_case') };
  }

  if (isObviousNonCase(trimmed)) {
    return { status: 'block', reason: 'not_a_case', message: messageFor('not_a_case') };
  }

  if (words.length > 0 && hasAnyPattern(trimmed, TOO_VAGUE_PATTERNS)) {
    return { status: 'needs_context', reason: 'too_vague', message: messageFor('too_vague') };
  }

  if (
    hasNonAsciiLetters(trimmed) &&
    (!hasAnyPattern(trimmed, ENGLISH_SOCIAL_PATTERNS) || hasMultilingualSocialContext(trimmed))
  ) {
    return {
      status: 'needs_context',
      reason: 'unsupported_local_language',
      message: messageFor('unsupported_local_language'),
    };
  }

  if (words.length > 0 && words.length < 15 && !hasSocialContext(trimmed)) {
    return { status: 'needs_context', reason: 'low_context', message: messageFor('low_context') };
  }

  return { status: 'ok', reason: 'ok', message: null };
}

export function shouldBlockNewCaseInput(inputText: string): boolean {
  return assessCaseInputQuality(inputText).status === 'block';
}
