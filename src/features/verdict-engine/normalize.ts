export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
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
