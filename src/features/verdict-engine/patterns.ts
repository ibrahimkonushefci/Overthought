import { normalizeText } from './normalize';
import type { SignalDefinition, TriggeredSignal } from './types';

export interface MatchSignalOptions {
  normalizedInput: string;
  normalizedUpdate: string;
  maxApplicationsPerSignal: number;
}

export function matchSignal(
  signal: SignalDefinition,
  options: MatchSignalOptions,
): Omit<TriggeredSignal, 'weightApplied'> | null {
  const normalizedPatterns = signal.patterns.map(normalizeText);

  const matchedInInput = normalizedPatterns.filter(
    (pattern) => pattern && options.normalizedInput.includes(pattern),
  );

  const matchedInUpdate = normalizedPatterns.filter(
    (pattern) => pattern && options.normalizedUpdate.includes(pattern),
  );

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
