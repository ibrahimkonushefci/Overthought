import { buildExplanationText, buildNextMoveText, inferConfidenceLevel } from './copy';
import { extractSemanticFacts, findSemanticScenarioOverride } from './facts';
import { clampNumber, buildHaystack } from './normalize';
import { matchSignal } from './patterns';
import { assessCaseInputQuality, type CaseInputQualityReason } from '../../shared/utils/caseInputQuality';
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
      hasEverySignal(scenario.requiredSignalIds, signalIds) &&
      !(scenario.excludedSignalIds ?? []).some((signalId) => signalIds.has(signalId)),
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

function applyGenericFallbackGuard(
  score: number,
  category: Category,
  scenario?: ScenarioOverride,
): number {
  if (scenario || score < 71) {
    return score;
  }

  if (category === 'friendship') {
    return Math.min(score, 68);
  }

  return Math.min(score, 70);
}

function shouldUseGenericFallbackCopy(score: number, scenario?: ScenarioOverride): boolean {
  return !scenario && score >= 71;
}

function shouldUseSemanticScenario(
  semanticScenario?: ScenarioOverride,
  configuredScenario?: ScenarioOverride,
): boolean {
  if (!semanticScenario) {
    return false;
  }

  if (!configuredScenario) {
    return true;
  }

  return (
    (semanticScenario.priority ?? 0) > (configuredScenario.priority ?? 0) &&
    [
      'canceled_plan_then_conflicting_post',
      'friendship_conflict_deflection_silence',
      'repeated_odd_gesture',
      'soft_invite_no_followthrough',
      'workplace_mixed_performance_signal',
    ].includes(semanticScenario.id)
  );
}

function needsMoreContextCopy(reason: CaseInputQualityReason): { explanationText: string; nextMoveText: string } {
  switch (reason) {
    case 'not_a_case':
      return {
        explanationText:
          'Overthought judges social situations, not homework, poems, or financial prophecy. This is not a case file yet.',
        nextMoveText: 'Bring one human doing one confusing thing, then ask what it means.',
      };
    case 'emoji_or_symbols_only':
    case 'repeated_characters':
    case 'repeated_words':
    case 'keyboard_gibberish':
    case 'random_words':
      return {
        explanationText:
          'This is not a judgeable case yet. Right now the evidence is keyboard fog wearing a tiny detective hat.',
        nextMoveText: 'Rewrite it with what happened, who did it, and the question you want judged.',
      };
    case 'unsupported_local_language':
      return {
        explanationText:
          "Basic Verdict can't read this clearly enough. Smart Verdict may understand this better, especially with clearer context.",
        nextMoveText: 'Add who did what, what happened, and what you want judged.',
      };
    case 'too_vague':
    case 'low_context':
    default:
      return {
        explanationText:
          'I can see the spiral, but not the receipts. I need one clear event before pretending this is a full case.',
        nextMoveText: 'Add who did what, what happened next, and what you are worried it means.',
      };
  }
}

function buildNeedsMoreContextResult(
  config: VerdictEngineConfig,
  reason: CaseInputQualityReason,
  options: { includeDebug?: boolean },
  semanticFacts: ReturnType<typeof extractSemanticFacts>,
): CaseAnalysisResult {
  const delusionScore = 24;
  const verdictLabel =
    config.verdictBands.find((band) => delusionScore >= band.min && delusionScore <= band.max)
      ?.label ?? 'slight_reach';
  const copy = needsMoreContextCopy(reason);
  const result: CaseAnalysisResult = {
    verdictLabel,
    delusionScore,
    explanationText: copy.explanationText,
    nextMoveText: copy.nextMoveText,
    verdictVersion: config.version,
    triggeredSignals: ['needs_more_context_input', reason],
    confidenceLevel: 'low',
  };

  if (options.includeDebug) {
    result.debug = {
      baseScore: config.baseScore,
      weakEvidenceDelta: 0,
      positiveEvidenceDelta: 0,
      contextModifierDelta: 0,
      rawScore: delusionScore,
      clampedScore: delusionScore,
      semanticFacts,
      matchedSignals: [],
    };
  }

  return result;
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
  const blocksBlankSlate = matchedSignals.some((signal) =>
    [
      'dry_text_anxiety',
      'explicit_rejection',
      'external_reason_context',
      'friendliness_misread_as_interest',
      'ghosted_history',
      'clear_negative_action',
      'low_effort_reengagement',
      'low_reciprocity_friendship',
      'no_concrete_followup',
      'stopped_replying_after_availability',
      'unavailable_in_person',
    ].includes(signal.id),
  );

  if (wordCount === 0 || wordCount >= 15 || hasDirectAction || blocksBlankSlate) {
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
  const { normalizedInput, normalizedUpdate, combined } = buildHaystack(
    input.inputText,
    input.updateText,
  );
  const semanticFacts = extractSemanticFacts({
    normalizedInput,
    normalizedUpdate,
    category: input.category,
  });
  const inputQuality = assessCaseInputQuality(input.inputText);

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

  const shouldUseNeedsMoreContextResult =
    inputQuality.status === 'block' ||
    (inputQuality.status === 'needs_context' &&
      (inputQuality.reason === 'too_vague' ||
        inputQuality.reason === 'unsupported_local_language' ||
        (matchedSignals.length === 0 && semanticFacts.ids.length < 2)));

  if (shouldUseNeedsMoreContextResult) {
    return buildNeedsMoreContextResult(config, inputQuality.reason, options, semanticFacts);
  }

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

  const configuredScenarioOverride = findScenarioOverride(
    config.scenarioOverrides,
    input.category,
    weightedSignals,
  );
  const semanticScenarioOverride = findSemanticScenarioOverride(semanticFacts, input.category);
  const scenarioOverride = shouldUseSemanticScenario(
    semanticScenarioOverride,
    configuredScenarioOverride,
  )
    ? semanticScenarioOverride
    : configuredScenarioOverride ?? semanticScenarioOverride;

  const scenarioAdjustedScore = applyScenarioBounds(rawScore, scenarioOverride);
  const genericFallbackApplied = shouldUseGenericFallbackCopy(
    scenarioAdjustedScore,
    scenarioOverride,
  );
  const fallbackGuardedScore = applyGenericFallbackGuard(
    scenarioAdjustedScore,
    input.category,
    scenarioOverride,
  );

  const delusionScore = clampNumber(
    Math.round(fallbackGuardedScore),
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
    combined,
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
    genericFallbackApplied,
    semanticFacts,
  });

  const nextMoveText = buildNextMoveText({
    score: delusionScore,
    scoreSeed,
    config,
    scenarioOverride,
    dominantSignalId,
    genericFallbackApplied,
    semanticFacts,
  });

  const inferredConfidenceLevel = inferConfidenceLevel(topSignals, delusionScore);
  const confidenceLevel =
    genericFallbackApplied && !scenarioOverride
      ? semanticFacts.ids.length >= 3
        ? 'medium'
        : 'low'
      : inferredConfidenceLevel;

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
      semanticFacts,
      matchedSignals: weightedSignals,
    };
  }

  return result;
}
