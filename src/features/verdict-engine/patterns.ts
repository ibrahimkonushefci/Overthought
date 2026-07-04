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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Match a plain phrase pattern on ASCII word boundaries so a pattern like
// "no plan" no longer matches inside "no planet", and "liked" no longer matches
// inside "disliked". The haystack is already normalized to [a-z0-9\s'], so \b
// (which anchors on [A-Za-z0-9_]) gives the intended boundaries. Falls back to a
// plain substring test only if the boundary regex fails to compile.
function matchWordBoundaryPhrase(normalizedPattern: string, haystack: string): boolean {
  try {
    return new RegExp(`\\b${escapeRegExp(normalizedPattern)}\\b`, 'i').test(haystack);
  } catch {
    return haystack.includes(normalizedPattern);
  }
}

function matchPattern(pattern: string, haystack: string): string | null {
  if (!pattern || !haystack) {
    return null;
  }

  if (!isRegexPattern(pattern)) {
    const normalizedPattern = normalizeText(pattern);
    return normalizedPattern && matchWordBoundaryPhrase(normalizedPattern, haystack)
      ? normalizedPattern
      : null;
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
