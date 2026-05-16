import { toTitleCase } from './normalize';
import type {
  ConfidenceLevel,
  ScenarioOverride,
  SemanticFacts,
  TriggeredSignal,
  VerdictEngineConfig,
} from './types';

const SIGNAL_COPY: Record<string, string> = {
  single_low_signal: 'a very small signal',
  delayed_reply: 'slow reply timing',
  vague_language: 'vague wording',
  no_concrete_followup: 'missing follow-through',
  mixed_signals: 'inconsistent behavior',
  assumption_without_action: 'a conclusion without enough action',
  friendliness_misread_as_interest: 'normal friendliness being treated like special interest',
  social_media_overread: 'social media behavior carrying too much weight',
  one_off_event: 'too much meaning from one moment',
  third_party_interpretation: 'other people shaping the conclusion',
  direct_action: 'direct effort',
  booked_logistics: 'handled logistics',
  consistent_effort: 'consistent effort',
  specific_interest: 'specific personal interest',
  clear_language: 'clear wording',
  reciprocity: 'balanced mutual effort',
  work_context: 'a work context that can blur meaning',
  friend_group_context: 'a group setting that makes signals less personal',
  existing_relationship_context: 'an already established connection',
  update_strengthens_case: 'an update with stronger evidence',
  update_weakens_case: 'an update that undercuts the original theory',
};

export function describeSignal(signalId: string): string {
  return SIGNAL_COPY[signalId] ?? toTitleCase(signalId.replace(/_/g, ' ')).toLowerCase();
}

function describeSignalForFallback(signal: TriggeredSignal): string {
  switch (signal.type) {
    case 'positive_evidence':
      return 'real evidence';
    case 'context_modifier':
      return 'important context';
    case 'weak_evidence':
    default:
      return 'a weak signal';
  }
}

function buildSemanticFallbackExplanationTemplates(facts?: SemanticFacts): string[] {
  if (!facts) {
    return [];
  }

  if (facts.hasActiveOnSocial && (facts.hasNoFollowThrough || facts.hasTextingNegative)) {
    return [
      'The app activity is real, but the missing direct reply matters more. Social motion is weaker than actual follow-through.',
      'They are active around the message, not in the message. That is worth noticing without turning it into a final verdict.',
    ];
  }

  if (facts.hasWorkPowerContext) {
    return [
      'The work context matters here. Keep the read tied to concrete follow-through, not private interpretation.',
      'This is work-context ambiguity, so the safest read is the practical one: what is documented, repeated, or acted on.',
    ];
  }

  if (facts.hasFriendContext && facts.hasNoFollowThrough) {
    return [
      'There is a friendship pattern worth noticing, but the read should stay tied to whether effort actually changes.',
      'The silence or missing follow-through is the real fact. The motive behind it is still the uncertain part.',
    ];
  }

  if (facts.hasRepeatedBehavior && facts.hasOddGiftOrObject) {
    return [
      'There is an odd repeated pattern here, but odd is not automatically meaningful. It needs direct clarification.',
      'The repetition is real. The meaning is still unproven until someone actually explains it.',
    ];
  }

  if (facts.hasSocialMediaSignal && facts.hasNoFollowThrough) {
    return [
      'There is social-media signal here, but the missing direct follow-through is the stronger fact.',
      'The online activity is visible, but it does not replace a direct reply, plan, or clear action.',
    ];
  }

  if (facts.hasNoFollowThrough) {
    return [
      'The missing follow-through is the real fact. The explanation around it is still uncertain.',
      'Something did not get followed through on, so keep the read focused on that pattern instead of filling in motive.',
    ];
  }

  if (facts.hasInvitation) {
    return [
      'There is an actual invite or opening here, so this is not nothing. The question is whether it turns into clear follow-through.',
      'An invitation counts as action, but it still needs context before it becomes a bigger conclusion.',
    ];
  }

  return [];
}

function buildSemanticFallbackNextMoveTemplates(facts?: SemanticFacts): string[] {
  if (!facts) {
    return [];
  }

  if (facts.hasActiveOnSocial && (facts.hasNoFollowThrough || facts.hasTextingNegative)) {
    return [
      'Let the direct reply matter more than the app activity.',
      'Do not chase the app activity. Wait for direct effort.',
    ];
  }

  if (facts.hasWorkPowerContext) {
    return [
      'Keep the next step practical and documented before reading deeper meaning into it.',
      'Look for clear work follow-through before treating the signal as personal.',
    ];
  }

  if (facts.hasFriendContext && facts.hasNoFollowThrough) {
    return [
      'Name the pattern once if it matters, then watch whether the effort changes.',
      'Do not over-explain the silence for them. Look for changed behavior.',
    ];
  }

  if (facts.hasRepeatedBehavior && facts.hasOddGiftOrObject) {
    return [
      'Ask directly about the odd pattern before assigning meaning to it.',
      'Clarify the repeated behavior once instead of decoding it alone.',
    ];
  }

  if (facts.hasNoFollowThrough) {
    return [
      'Wait for follow-through before making this bigger.',
      'Keep the read on what they do next, not what the silence might mean.',
    ];
  }

  if (facts.hasInvitation) {
    return [
      'Let the invite become a real plan before upgrading the read.',
      'Ask one clear logistics question if you want clarity.',
    ];
  }

  return [];
}

export function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pickDeterministic<T>(items: T[], seed: string): T {
  if (!items.length) {
    throw new Error('Cannot pick from empty array.');
  }

  const index = hashString(seed) % items.length;
  return items[index];
}

export function scoreBucket(
  score: number,
  config: VerdictEngineConfig,
): keyof VerdictEngineConfig['explanationTemplates'] {
  if (score >= 71) {
    return 'high';
  }

  if (score >= 41) {
    return 'mid';
  }

  return 'low';
}

export function getBandKey(score: number, config: VerdictEngineConfig): string {
  const band =
    config.verdictBands.find((item) => score >= item.min && score <= item.max) ??
    config.verdictBands[config.verdictBands.length - 1];

  return `${band.min}-${band.max}`;
}

export function buildExplanationText(args: {
  score: number;
  scoreSeed: string;
  config: VerdictEngineConfig;
  topSignals: TriggeredSignal[];
  scenarioOverride?: ScenarioOverride;
  previousScoreDelta?: number;
  genericFallbackApplied?: boolean;
  semanticFacts?: SemanticFacts;
}): string {
  if (args.scenarioOverride) {
    return pickDeterministic(
      args.scenarioOverride.explanationTemplates,
      `${args.scoreSeed}|scenario|${args.scenarioOverride.id}`,
    );
  }

  const semanticFallbackTemplates = buildSemanticFallbackExplanationTemplates(args.semanticFacts);
  if (semanticFallbackTemplates.length > 0) {
    return pickDeterministic(
      semanticFallbackTemplates,
      `${args.scoreSeed}|semantic-fallback-explanation`,
    );
  }

  if (args.genericFallbackApplied) {
    const strongestSignals = args.topSignals.slice(0, 2);
    const reasonText =
      strongestSignals.length > 0
        ? Array.from(new Set(strongestSignals.map(describeSignalForFallback))).join(' and ')
        : 'thin evidence';
    const templates = [
      `The strongest signal is ${reasonText}. That is worth noticing, but it is not enough for a dramatic verdict without more concrete behavior.`,
      `This has ${reasonText}, so the concern is not random. The read should stay provisional until the behavior gets clearer.`,
      `Right now, ${reasonText} is doing most of the work here. Keep the conclusion tied to what actually happened, not the story around it.`,
    ];

    return pickDeterministic(templates, `${args.scoreSeed}|fallback-explanation`);
  }

  const baseTemplate = pickDeterministic(
    args.config.explanationTemplates[scoreBucket(args.score, args.config)],
    args.scoreSeed,
  );

  let updateSentence = '';
  if (typeof args.previousScoreDelta === 'number') {
    if (args.previousScoreDelta <= -8) {
      updateSentence = ' Compared with the previous read, this update makes the case look stronger.';
    } else if (args.previousScoreDelta >= 8) {
      updateSentence =
        ' Compared with the previous read, this update makes the case look shakier.';
    }
  }

  return `${baseTemplate}${updateSentence}`.trim();
}

export function buildNextMoveText(args: {
  score: number;
  scoreSeed: string;
  config: VerdictEngineConfig;
  scenarioOverride?: ScenarioOverride;
  dominantSignalId?: string;
  genericFallbackApplied?: boolean;
  semanticFacts?: SemanticFacts;
}): string {
  if (args.scenarioOverride) {
    return pickDeterministic(
      args.scenarioOverride.nextMoveTemplates,
      `${args.scoreSeed}|scenario-next|${args.scenarioOverride.id}`,
    );
  }

  const semanticFallbackTemplates = buildSemanticFallbackNextMoveTemplates(args.semanticFacts);
  if (semanticFallbackTemplates.length > 0) {
    return pickDeterministic(
      semanticFallbackTemplates,
      `${args.scoreSeed}|semantic-fallback-next`,
    );
  }

  if (args.genericFallbackApplied) {
    const templates = [
      'Ask for or wait for concrete behavior before making this bigger.',
      'Keep the read cautious until there is a clearer pattern.',
      'Treat this as a provisional signal, not a final verdict.',
    ];

    return pickDeterministic(templates, `${args.scoreSeed}|fallback-next`);
  }

  if (
    args.dominantSignalId &&
    args.config.dominantSignalOverrides[args.dominantSignalId]?.length
  ) {
    return pickDeterministic(
      args.config.dominantSignalOverrides[args.dominantSignalId],
      `${args.scoreSeed}|dominant`,
    );
  }

  const bandKey = getBandKey(args.score, args.config);
  const templates = args.config.nextMoveTemplates[bandKey] ?? [];
  return pickDeterministic(templates, `${args.scoreSeed}|next-move`);
}

export function inferConfidenceLevel(topSignals: TriggeredSignal[], score: number): ConfidenceLevel {
  if (
    topSignals.some((signal) =>
      ['clear_language', 'direct_action', 'no_concrete_followup', 'mixed_signals'].includes(
        signal.id,
      ),
    ) ||
    topSignals.length >= 3
  ) {
    return 'high';
  }

  if (topSignals.length >= 1 || score <= 30 || score >= 70) {
    return 'medium';
  }

  return 'low';
}
