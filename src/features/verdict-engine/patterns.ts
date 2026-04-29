import { normalizeText } from './normalize';
import type { SignalDefinition, TriggeredSignal } from './types';

export interface MatchSignalOptions {
  normalizedInput: string;
  normalizedUpdate: string;
  maxApplicationsPerSignal: number;
}

function isRegexPattern(pattern: string): boolean {
  return pattern.startsWith('/') && pattern.lastIndexOf('/') > 0;
}

function matchPattern(pattern: string, haystack: string): string | null {
  if (!pattern || !haystack) {
    return null;
  }

  if (!isRegexPattern(pattern)) {
    const normalizedPattern = normalizeText(pattern);
    return normalizedPattern && haystack.includes(normalizedPattern) ? normalizedPattern : null;
  }

  const lastSlashIndex = pattern.lastIndexOf('/');
  const body = pattern.slice(1, lastSlashIndex);
  const flags = pattern.slice(lastSlashIndex + 1);

  try {
    const expression = new RegExp(body, flags.includes('i') ? flags : `${flags}i`);
    const match = haystack.match(expression);
    return match?.[0] ?? null;
  } catch {
    const normalizedPattern = normalizeText(pattern);
    return normalizedPattern && haystack.includes(normalizedPattern) ? normalizedPattern : null;
  }
}

export function matchSignal(
  signal: SignalDefinition,
  options: MatchSignalOptions,
): Omit<TriggeredSignal, 'weightApplied'> | null {
  const matchedInInput = signal.patterns
    .map((pattern) => matchPattern(pattern, options.normalizedInput))
    .filter((pattern): pattern is string => Boolean(pattern));

  const matchedInUpdate = signal.patterns
    .map((pattern) => matchPattern(pattern, options.normalizedUpdate))
    .filter((pattern): pattern is string => Boolean(pattern));

  const uniqueMatches = Array.from(new Set([...matchedInInput, ...matchedInUpdate])).slice(
    0,
    options.maxApplicationsPerSignal,
  );

  if (uniqueMatches.length === 0) {
    return null;
  }

  const source: TriggeredSignal['source'] =
    matchedInInput.length > 0 && matchedInUpdate.length > 0
      ? 'both'
      : matchedInUpdate.length > 0
        ? 'update'
        : 'input';

  return {
    id: signal.id,
    type: signal.type,
    matchedPatterns: uniqueMatches,
    source,
  };
}
