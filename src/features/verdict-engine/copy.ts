import { toTitleCase } from './normalize';
import type {
  ConfidenceLevel,
  ScenarioOverride,
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
}): string {
  if (args.scenarioOverride) {
    return pickDeterministic(
      args.scenarioOverride.explanationTemplates,
      `${args.scoreSeed}|scenario|${args.scenarioOverride.id}`,
    );
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
}): string {
  if (args.scenarioOverride) {
    return pickDeterministic(
      args.scenarioOverride.nextMoveTemplates,
      `${args.scoreSeed}|scenario-next|${args.scenarioOverride.id}`,
    );
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
