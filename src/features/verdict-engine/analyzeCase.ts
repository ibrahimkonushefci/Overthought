import { buildExplanationText, buildNextMoveText, inferConfidenceLevel } from './copy';
import { clampNumber, buildHaystack } from './normalize';
import { matchSignal } from './patterns';
import type {
  CaseAnalysisInput,
  CaseAnalysisResult,
  Category,
  SignalDefinition,
  TriggeredSignal,
  VerdictEngineConfig,
} from './types';

function getAppliedWeight(signal: SignalDefinition, category: Category): number {
  return signal.categoryWeightOverrides?.[category] ?? signal.defaultWeight;
}

function capDelta(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function analyzeCase(
  config: VerdictEngineConfig,
  input: CaseAnalysisInput,
  options: { includeDebug?: boolean } = {},
): CaseAnalysisResult {
  const { normalizedInput, normalizedUpdate } = buildHaystack(input.inputText, input.updateText);

  const matchedSignals: TriggeredSignal[] = config.signals
    .map((signal) => {
      const match = matchSignal(signal, {
        normalizedInput,
        normalizedUpdate,
        maxApplicationsPerSignal: config.caps.maxApplicationsPerSignal,
      });

      if (!match) {
        return null;
      }

      return {
        ...match,
        weightApplied: getAppliedWeight(signal, input.category),
      } satisfies TriggeredSignal;
    })
    .filter((value): value is TriggeredSignal => Boolean(value));

  const weakEvidenceRaw = matchedSignals
    .filter((signal) => signal.type === 'weak_evidence')
    .reduce((total, signal) => total + Math.max(signal.weightApplied, 0), 0);

  const positiveEvidenceRaw = matchedSignals
    .filter((signal) => signal.type === 'positive_evidence')
    .reduce((total, signal) => total + Math.min(signal.weightApplied, 0), 0);

  const contextModifierRaw = matchedSignals
    .filter((signal) => signal.type === 'context_modifier')
    .reduce((total, signal) => total + signal.weightApplied, 0);

  const weakEvidenceDelta = capDelta(
    weakEvidenceRaw,
    0,
    config.caps.maxWeakEvidenceIncrease,
  );

  const positiveEvidenceDelta = capDelta(
    positiveEvidenceRaw,
    -config.caps.maxPositiveEvidenceReduction,
    0,
  );

  const contextModifierDelta = capDelta(
    contextModifierRaw,
    -config.caps.maxContextModifierAdjustment,
    config.caps.maxContextModifierAdjustment,
  );

  const rawScore =
    config.baseScore + weakEvidenceDelta + positiveEvidenceDelta + contextModifierDelta;

  const delusionScore = clampNumber(
    Math.round(rawScore),
    config.scoreClamp.min,
    config.scoreClamp.max,
  );

  const verdictLabel =
    config.verdictBands.find((band) => delusionScore >= band.min && delusionScore <= band.max)
      ?.label ?? config.verdictBands[config.verdictBands.length - 1].label;

  const topSignals = [...matchedSignals].sort(
    (left, right) => Math.abs(right.weightApplied) - Math.abs(left.weightApplied),
  );

  const dominantSignalId = topSignals[0]?.id;
  const scoreSeed = [
    input.category,
    input.inputText,
    input.updateText ?? '',
    topSignals.map((signal) => signal.id).join('|'),
    String(delusionScore),
  ].join('|');

  const previousScoreDelta =
    typeof input.previousCaseContext?.priorScore === 'number'
      ? delusionScore - input.previousCaseContext.priorScore
      : undefined;

  const explanationText = buildExplanationText({
    score: delusionScore,
    scoreSeed,
    config,
    topSignals,
    previousScoreDelta,
  });

  const nextMoveText = buildNextMoveText({
    score: delusionScore,
    scoreSeed,
    config,
    dominantSignalId,
  });

  const confidenceLevel = inferConfidenceLevel(topSignals, delusionScore);

  const result: CaseAnalysisResult = {
    verdictLabel,
    delusionScore,
    explanationText,
    nextMoveText,
    triggeredSignals: matchedSignals.map((signal) => signal.id),
    confidenceLevel,
  };

  if (options.includeDebug) {
    result.debug = {
      baseScore: config.baseScore,
      weakEvidenceDelta,
      positiveEvidenceDelta,
      contextModifierDelta,
      rawScore,
      clampedScore: delusionScore,
      previousScoreDelta,
      dominantSignalId,
      matchedSignals,
    };
  }

  return result;
}
