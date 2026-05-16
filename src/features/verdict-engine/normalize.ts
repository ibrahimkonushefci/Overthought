export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\bi'?m\b/g, 'i am')
    .replace(/\bdon'?t\b/g, 'do not')
    .replace(/\bdoesn'?t\b/g, 'does not')
    .replace(/\bdidn'?t\b/g, 'did not')
    .replace(/\bhasn'?t\b/g, 'has not')
    .replace(/\bhaven'?t\b/g, 'have not')
    .replace(/\bisn'?t\b/g, 'is not')
    .replace(/\baren'?t\b/g, 'are not')
    .replace(/\bwasn'?t\b/g, 'was not')
    .replace(/\bweren'?t\b/g, 'were not')
    .replace(/\bwon'?t\b/g, 'will not')
    .replace(/\bcan'?t\b/g, 'cannot')
    .replace(/\bwouldn'?t\b/g, 'would not')
    .replace(/\bcouldn'?t\b/g, 'could not')
    .replace(/\bshouldn'?t\b/g, 'should not')
    .replace(/\bdm'?d\b/g, 'dmed')
    .replace(/\bhang[\s-]?out\b/g, 'hang out')
    .replace(/\blink up\b/g, 'hang out')
    .replace(/\bcome over\b/g, 'hang out')
    .replace(/\bchill\b/g, 'hang out')
    .replace(/\bcancelled\b/g, 'canceled')
    .replace(/\bleft on delivered\b/g, 'left me on delivered')
    .replace(/\bon delivered\b/g, 'on delivered')
    .replace(/\bposted a picture\b/g, 'posted')
    .replace(/\bput (?:it )?on (?:her |his |their )?story\b/g, 'posted story')
    .replace(/\bperformance review\b/g, 'performance review')
    .replace(/\bquietly fired\b/g, 'quietly fired')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildHaystack(inputText: string, updateText?: string): {
  normalizedInput: string;
  normalizedUpdate: string;
  combined: string;
} {
  const normalizedInput = normalizeText(inputText);
  const normalizedUpdate = normalizeText(updateText ?? '');
  const combined = [normalizedInput, normalizedUpdate].filter(Boolean).join(' ').trim();

  return {
    normalizedInput,
    normalizedUpdate,
    combined,
  };
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
