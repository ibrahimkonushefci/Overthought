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
  stale_social_media_signal: 'an old social-media crumb',
  no_response_after_match: 'a match that went quiet',
  delayed_reply: 'slow reply timing',
  stopped_replying_after_availability: 'them going quiet once you asked for a real day',
  message_avoidance: 'them dodging the actual message',
  heart_emoji_signal: 'a lone emoji reaction',
  late_night_text: 'after-midnight texting',
  late_night_intimacy: 'late-night closeness with nothing in daylight',
  dry_text_anxiety: 'dry, low-effort texting',
  vague_language: 'vague wording',
  soft_decline: 'a soft, polite brush-off',
  needy_gesture_anxiety: 'normal effort being treated like neediness',
  casual_refusal: 'a casual refusal being decoded for hidden meaning',
  enthusiasm_drop: 'a noticeable drop in excitement',
  no_concrete_followup: 'missing follow-through',
  mixed_signals: 'inconsistent behavior',
  unavailable_in_person: 'someone who never actually shows up in person',
  assumption_without_action: 'a conclusion without enough action',
  main_character_syndrome: 'a main-character read of a normal moment',
  party_silence_anxiety: 'reading silence at a party as a verdict',
  party_ignored_anxiety: 'a quiet party being read as a group verdict on you',
  academic_feedback_context: 'work feedback being read as a personal verdict',
  friendliness_misread_as_interest: 'normal friendliness being treated like special interest',
  social_media_overread: 'social media behavior carrying too much weight',
  ghosted_history: 'a history of ghosting',
  low_effort_reengagement: 'a low-effort reappearance',
  no_questions_about_user: 'someone who never asks about you',
  finance_monologue: 'a one-sided money monologue',
  explicit_rejection: 'a stated no',
  coincidence_marker: 'a coincidence being read as a sign',
  one_off_event: 'too much meaning from one moment',
  blank_slate_short_prompt: 'almost no actual detail to go on',
  casual_content: 'a casual, low-stakes message',
  pet_specific_interest: 'attention that is really about the pet',
  third_party_interpretation: 'other people shaping the conclusion',
  work_smiley_overread: 'a friendly work message read as flirting',
  deep_scroll_signal: 'a deep-scroll like on an old post',
  no_dm_signal: 'activity that never turns into a real message',
  proximity_without_interaction: 'being near someone without any real interaction',
  no_direct_interaction: 'no direct interaction at all',
  friendship_one_sided_initiation: 'you being the one who always reaches out',
  low_reciprocity_friendship: 'effort that mostly runs one direction',
  long_term_duration: 'a long stretch of time with little to show for it',
  high_physical_financial_effort: 'big effort spent without a clear commitment',
  relationship_commitment_absent: 'a missing actual commitment',
  soft_invite_disclaimer: 'an invite hedged with a disclaimer',
  ex_no_contact_context: 'an ex resurfacing after no contact',
  follow_back_without_dm: 'a follow-back that never became a message',
  friendship_one_sided_planning: 'you doing all the planning',
  stopped_texting_duration: 'the texts drying up for days',
  direct_action: 'direct effort',
  verbal_dinner_interest: 'a real spoken interest in meeting up',
  clear_negative_action: 'a clear closing action',
  relationship_confirmed_signal: 'a confirmed relationship',
  booked_logistics: 'handled logistics',
  expensive_date: 'real effort put into the date',
  consistent_effort: 'consistent effort',
  apology_repair: 'an actual apology and repair',
  external_reason_context: 'a real outside reason',
  outside_work_one_on_one: 'real one-on-one time outside of work',
  specific_interest: 'specific personal interest',
  clear_language: 'clear wording',
  workplace_perk: 'a normal workplace perk',
  reciprocity: 'balanced mutual effort',
  friendship_birthday_signal: 'a real birthday invite',
  work_context: 'a work context that can blur meaning',
  authority_work_context: 'a boss-and-report power gap',
  professional_routine_context: 'ordinary professional routine',
  group_invite_context: 'a group invite rather than a personal one',
  friend_group_context: 'a group setting that makes signals less personal',
  best_friend_context: 'an already close friendship',
  existing_relationship_context: 'an already established connection',
  update_strengthens_case: 'an update with stronger evidence',
  update_weakens_case: 'an update that undercuts the original theory',
  friendship_drift: 'a connection slowly cooling off',
  excluded_from_plans: 'being left out of a hangout',
  replaced_by_friend: 'feeling replaced by a newer friend',
  family_context: 'a family relationship in the mix',
  family_criticism: 'a parent’s harsh criticism',
  family_favoritism: 'a sense of being the less-favored one',
  family_guilt: 'a guilt trip from family',
  work_exclusion: 'being left out of things at work',
  manager_tone_shift: 'a manager who has gone colder lately',
  layoff_anxiety: 'a fear of being let go',
  credit_taken: 'a coworker taking your credit',
  matched_no_message: 'a match that never became a message',
  unmatched_me: 'getting unmatched',
  still_active_dating_app: 'someone who is still active on the app',
  profile_update_overread: 'a profile tweak being read as a message',
};

export function describeSignal(signalId: string): string {
  return SIGNAL_COPY[signalId] ?? toTitleCase(signalId.replace(/_/g, ' ')).toLowerCase();
}

function describeTopSignalsForFallback(signals: TriggeredSignal[]): string {
  const described = Array.from(new Set(signals.slice(0, 2).map((signal) => describeSignal(signal.id))));

  if (described.length === 0) {
    return 'thin evidence';
  }

  return described.join(' and ');
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

  if (score >= 46) {
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
    const reasonText = describeTopSignalsForFallback(args.topSignals);
    const templates = [
      `The loudest thing here is ${reasonText}, and that is worth noticing without turning it into a full verdict.`,
      `Most of this read is riding on ${reasonText}. Keep it tied to what actually happened, not the story around it.`,
      `Right now this mostly comes down to ${reasonText}, so the concern is real but not proven.`,
      `What you actually have is ${reasonText}, which is enough to wonder and not enough to conclude.`,
      `The strongest thread is ${reasonText}. Notice it, but do not let it write the whole ending.`,
      `This is leaning hard on ${reasonText}, and that alone cannot carry the theory yet.`,
      `The case is basically ${reasonText} doing the heavy lifting, and it is asking for a lot.`,
      `So far it is ${reasonText} and a lot of interpretation stacked on top of it.`,
      `The evidence in play is ${reasonText}, which points somewhere but does not land anywhere solid.`,
      `You are working with ${reasonText}. That earns a raised eyebrow, not a confident verdict.`,
      `Strip it down and it is ${reasonText}. Keep the read provisional until the behavior gets clearer.`,
      `The read hangs on ${reasonText}, so treat it as a lead, not a conclusion.`,
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

  // A dominant-signal next move is more specific than the generic fallback pool,
  // so it wins even when the fallback guard capped the score.
  if (
    args.dominantSignalId &&
    args.config.dominantSignalOverrides[args.dominantSignalId]?.length
  ) {
    return pickDeterministic(
      args.config.dominantSignalOverrides[args.dominantSignalId],
      `${args.scoreSeed}|dominant`,
    );
  }

  if (args.genericFallbackApplied) {
    const templates = [
      'Wait for concrete behavior before making this bigger.',
      'Keep the read cautious until there is a clearer pattern.',
      'Treat this as a provisional signal, not a final verdict.',
      'Watch what they actually do next instead of decoding what they did.',
      'Give it one more real data point before you commit to a story.',
      'Do not escalate off this alone. Let the next move come from them.',
      'Name it once if it matters, then watch whether anything changes.',
      'Hold the theory loosely until the behavior backs it up.',
      'Let time and follow-through decide this, not tonight’s overthinking.',
      'Ask a direct question if you need clarity instead of guessing at it.',
    ];

    return pickDeterministic(templates, `${args.scoreSeed}|fallback-next`);
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
