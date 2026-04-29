import { buildExplanationText, buildNextMoveText, inferConfidenceLevel } from './copy';
import { clampNumber, buildHaystack } from './normalize';
import { matchSignal } from './patterns';
import type {
  CaseAnalysisInput,
  CaseAnalysisResult,
  Category,
  ScenarioOverride,
  SignalDefinition,
  SignalNeutralizer,
  TriggeredSignal,
  VerdictEngineConfig,
} from './types';

function getAppliedWeight(signal: SignalDefinition, category: Category): number {
  return signal.categoryWeightOverrides?.[category] ?? signal.defaultWeight;
}

function capDelta(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hasEverySignal(requiredSignalIds: string[], signalIds: Set<string>): boolean {
  return requiredSignalIds.every((signalId) => signalIds.has(signalId));
}

function applySignalNeutralizers(
  matchedSignals: TriggeredSignal[],
  neutralizers: SignalNeutralizer[],
): TriggeredSignal[] {
  const signalIds = new Set(matchedSignals.map((signal) => signal.id));
  const activeNeutralizers = neutralizers.filter((neutralizer) =>
    hasEverySignal(neutralizer.requiredSignalIds, signalIds) &&
    !(neutralizer.excludedSignalIds ?? []).some((signalId) => signalIds.has(signalId)),
  );

  if (activeNeutralizers.length === 0) {
    return matchedSignals;
  }

  return matchedSignals.map((signal) => {
    const neutralizedBy = activeNeutralizers
      .filter((neutralizer) => neutralizer.affectedSignalIds.includes(signal.id))
      .map((neutralizer) => neutralizer.id);

    if (neutralizedBy.length === 0) {
      return signal;
    }

    return {
      ...signal,
      originalWeightApplied: signal.originalWeightApplied ?? signal.weightApplied,
      weightApplied: 0,
      neutralizedBy: [...(signal.neutralizedBy ?? []), ...neutralizedBy],
    };
  });
}

function findScenarioOverride(
  scenarios: ScenarioOverride[],
  category: Category,
  matchedSignals: TriggeredSignal[],
): ScenarioOverride | undefined {
  const signalIds = new Set(matchedSignals.map((signal) => signal.id));

  return scenarios
    .filter(
      (scenario) =>
      (!scenario.category || scenario.category === category) &&
      hasEverySignal(scenario.requiredSignalIds, signalIds),
    )
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0];
}

function applyScenarioBounds(score: number, scenario?: ScenarioOverride): number {
  if (!scenario) {
    return score;
  }

  let adjustedScore = score;

  if (typeof scenario.scoreFloor === 'number') {
    adjustedScore = Math.max(adjustedScore, scenario.scoreFloor);
  }

  if (typeof scenario.scoreCeiling === 'number') {
    adjustedScore = Math.min(adjustedScore, scenario.scoreCeiling);
  }

  return adjustedScore;
}

function buildSyntheticSignal(
  signalId: string,
  config: VerdictEngineConfig,
  category: Category,
  matchedPattern: string,
): TriggeredSignal | null {
  const definition = config.signals.find((signal) => signal.id === signalId);

  if (!definition) {
    return null;
  }

  return {
    id: definition.id,
    type: definition.type,
    weightApplied: getAppliedWeight(definition, category),
    matchedPatterns: [matchedPattern],
    source: 'input',
  };
}

function applyBlankSlateRule(
  matchedSignals: TriggeredSignal[],
  config: VerdictEngineConfig,
  category: Category,
  normalizedInput: string,
): TriggeredSignal[] {
  const wordCount = normalizedInput.split(' ').filter(Boolean).length;
  const hasDirectAction = matchedSignals.some((signal) => signal.id === 'direct_action');

  if (wordCount === 0 || wordCount >= 15 || hasDirectAction) {
    return matchedSignals;
  }

  const signalIds = new Set(matchedSignals.map((signal) => signal.id));
  const syntheticSignals = [
    signalIds.has('assumption_without_action')
      ? null
      : buildSyntheticSignal(
          'assumption_without_action',
          config,
          category,
          'short_prompt_without_action',
        ),
    signalIds.has('blank_slate_short_prompt')
      ? null
      : buildSyntheticSignal(
          'blank_slate_short_prompt',
          config,
          category,
          'short_prompt_without_action',
        ),
  ].filter((signal): signal is TriggeredSignal => Boolean(signal));

  if (syntheticSignals.length === 0) {
    return matchedSignals;
  }

  return [...matchedSignals, ...syntheticSignals];
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

  const signalsWithSyntheticRules = applyBlankSlateRule(
    matchedSignals,
    config,
    input.category,
    normalizedInput,
  );

  const weightedSignals = applySignalNeutralizers(
    signalsWithSyntheticRules,
    config.signalNeutralizers,
  );

  const weakEvidenceRaw = weightedSignals
    .filter((signal) => signal.type === 'weak_evidence')
    .reduce((total, signal) => total + Math.max(signal.weightApplied, 0), 0);

  const positiveEvidenceRaw = weightedSignals
    .filter((signal) => signal.type === 'positive_evidence')
    .reduce((total, signal) => total + Math.min(signal.weightApplied, 0), 0);

  const contextModifierRaw = weightedSignals
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

  const scenarioOverride = findScenarioOverride(
    config.scenarioOverrides,
    input.category,
    weightedSignals,
  );

  const scenarioAdjustedScore = applyScenarioBounds(rawScore, scenarioOverride);

  const delusionScore = clampNumber(
    Math.round(scenarioAdjustedScore),
    config.scoreClamp.min,
    config.scoreClamp.max,
  );

  const verdictLabel =
    config.verdictBands.find((band) => delusionScore >= band.min && delusionScore <= band.max)
      ?.label ?? config.verdictBands[config.verdictBands.length - 1].label;

  const topSignals = [...weightedSignals].sort(
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
    scenarioOverride,
    previousScoreDelta,
  });

  const nextMoveText = buildNextMoveText({
    score: delusionScore,
    scoreSeed,
    config,
    scenarioOverride,
    dominantSignalId,
  });

  const confidenceLevel = inferConfidenceLevel(topSignals, delusionScore);

  const result: CaseAnalysisResult = {
    verdictLabel,
    delusionScore,
    explanationText,
    nextMoveText,
    verdictVersion: config.version,
    triggeredSignals: signalsWithSyntheticRules.map((signal) => signal.id),
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
      scenarioOverrideId: scenarioOverride?.id,
      matchedSignals: weightedSignals,
    };
  }

  return result;
}
