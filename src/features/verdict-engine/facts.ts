import type { Category, ScenarioOverride, SemanticFactId, SemanticFacts } from './types';

const SEMANTIC_FACT_IDS: SemanticFactId[] = [
  'hasInvitation',
  'hasSpecificPlan',
  'hasTimeOrDate',
  'hasNoFollowThrough',
  'hasDelayedReply',
  'hasGhosting',
  'hasLateNightTiming',
  'hasLateNightReply',
  'hasSocialMediaSignal',
  'hasStrangerSignal',
  'hasEyeContact',
  'hasWorkPowerContext',
  'hasFriendContext',
  'hasConcreteNegativeAction',
  'hasApology',
  'hasExplanation',
  'hasMixedConsistency',
  'hasInPersonPositive',
  'hasTextingNegative',
  'hasQuestionForAvailability',
  'hasUserConclusion',
  'hasDinnerContext',
  'hasDeliveredNoReply',
  'hasActiveOnSocial',
  'hasCanceledPlan',
  'hasExcuse',
  'hasContradictorySocialPost',
  'hasRepeatedBehavior',
  'hasOddGiftOrObject',
  'hasNeighborContext',
  'hasWorkCriticism',
  'hasPrivateReassurance',
  'hasPromotionSignal',
  'hasIgnoredImportantEvent',
  'hasDeflection',
  'hasUserForcedToApologize',
  'hasFormalWorkAmbiguity',
];

function hasAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function buildFacts(activeFactIds: SemanticFactId[]): SemanticFacts {
  const uniqueFactIds = Array.from(new Set(activeFactIds));
  const facts = SEMANTIC_FACT_IDS.reduce(
    (accumulator, factId) => ({
      ...accumulator,
      [factId]: uniqueFactIds.includes(factId),
    }),
    {} as Record<SemanticFactId, boolean>,
  );

  return {
    ...facts,
    ids: uniqueFactIds,
  };
}

export function extractSemanticFacts(args: {
  normalizedInput: string;
  normalizedUpdate: string;
  category: Category;
}): SemanticFacts {
  const text = [args.normalizedInput, args.normalizedUpdate].filter(Boolean).join(' ');
  const activeFactIds: SemanticFactId[] = [];

  const hasInvitation = hasAny(text, [
    /\binvit(?:e|ed|es|ing)\b/,
    /\basked me to hang(?: out)?\b/,
    /\bjust asked me to hang(?: out)?\b/,
    /\basked if .{0,50}\bhang(?: out)?\b/,
    /\basked .{0,50}\bdinner\b/,
    /\bhang out\b/,
    /\basked me to (?:come over|link up|chill)\b/,
    /\bcome over\b/,
    /\blink up\b/,
    /\bchill\b/,
    /\bgrab dinner\b/,
    /\bdinner date\b/,
    /\bdown for (?:a )?(?:dinner|dinner date|date)\b/,
    /\bwant(?:ed)? to grab (?:dinner|drinks)\b/,
    /\bwe should hang out\b/,
    /\bshould hang out sometime\b/,
  ]);
  const hasDinnerContext = hasAny(text, [
    /\bdinner\b/,
    /\bdinner date\b/,
    /\bgrab drinks\b/,
    /\bdrinks\b/,
    /\bdate\b/,
  ]);
  const hasQuestionForAvailability = hasAny(text, [
    /\basked (?:if|when) .{0,70}\b(?:free|available)\b/,
    /\bwhen (?:she|he|they|you|i) (?:is|are|am|was|were) (?:free|available)\b/,
    /\bif (?:she|he|they|you|i) (?:is|are|am|was|were) (?:free|available)\b/,
    /\bwhat (?:day|time) .{0,40}\b(?:free|available|works)\b/,
    /\basked .{0,30}\bwhat (?:day|time)\b/,
  ]);
  const hasNoFollowThrough = hasAny(text, [
    /\bstopped replying\b/,
    /\bwent quiet\b/,
    /\bnever (?:texted|replied|responded|followed up)\b/,
    /\bnever replies\b/,
    /\bnever replied\b/,
    /\bnever replies to .{0,30}messages\b/,
    /\bnever starts conversations\b/,
    /\bnever actually picks\b/,
    /\bnever makes? (?:real )?plans\b/,
    /\bdoes not make time\b/,
    /\bdoesnt make time\b/,
    /\bno (?:plan|date|response|reply|follow(?: |-)?up)\b/,
    /\bdid not (?:reply|respond|follow up)\b/,
    /\bhas not (?:replied|responded|followed up)\b/,
    /\bhas not texted\b/,
    /\bhave not texted\b/,
    /\bleft me on read\b/,
    /\bleft me on delivered\b/,
    /\bleft on read\b/,
    /\bleft on delivered\b/,
    /\bcomplete silence\b/,
    /\bdisappeared\b/,
    /\bignored me\b/,
    /\bignored\b/,
    /\bdid not suggest another day\b/,
    /\bdidnt suggest another day\b/,
    /\bwithout another day\b/,
  ]);
  const hasDelayedReply = hasAny(text, [
    /\breplied after\b/,
    /\bresponded after\b/,
    /\bafter (?:like )?\d+ (?:days?|hours?)\b/,
    /\bafter (?:like )?(?:one|two|three|four|five|six|seven|eight|nine|ten) (?:days?|hours?)\b/,
    /\b\d+ (?:days?|hours?)\b/,
    /\b(?:one|two|three|four|five|six|seven|eight|nine|ten) (?:days?|hours?)\b/,
    /\bfor \d+ (?:days?|hours?)\b/,
    /\bfull week\b/,
    /\bwhole week\b/,
    /\bfor a week\b/,
    /\bleft me on read\b/,
    /\bleft me on delivered\b/,
  ]);
  const hasGhosting = hasAny(text, [
    /\bghosted\b/,
    /\bstopped replying\b/,
    /\bwent quiet\b/,
    /\bleft me on read\b/,
    /\bleft me on delivered\b/,
    /\bfull week\b/,
    /\bwhole week\b/,
    /\bsilence\b/,
    /\bdisappeared\b/,
    /\bhas not texted\b/,
    /\bhave not texted\b/,
  ]);
  const hasLateNightTiming = hasAny(text, [
    /\b(?:1|2|3|11|12)\s*(?:am|pm)\b/,
    /\bafter midnight\b/,
    /\bmidnight\b/,
  ]);
  const hasLateNightReply =
    hasLateNightTiming &&
    hasAny(text, [/\b(?:replied|responded|texted|messaged|message|came back)\b/]);
  const hasSocialMediaSignal = hasAny(text, [
    /\bstory\b/,
    /\bstories\b/,
    /\binstagram\b/,
    /\btiktok\b/,
    /\bsnap(?:chat)?\b/,
    /\bliked\b/,
    /\bviewed\b/,
    /\bwatched\b/,
    /\bprofile\b/,
    /\bfollowed me back\b/,
    /\bfollowed back\b/,
  ]);
  const hasEyeContact = hasAny(text, [
    /\beye contact\b/,
    /\blooked at me\b/,
    /\blooking at me\b/,
    /\bstaring\b/,
    /\bstared\b/,
  ]);
  const hasStrangerSignal = hasAny(text, [
    /\ba guy\b/,
    /\ba girl\b/,
    /\bstranger\b/,
    /\brestaurant\b/,
    /\bbar\b/,
    /\bgym\b/,
    /\bcafe\b/,
    /\blibrary\b/,
    /\bclass\b/,
    /\bevents?\b/,
    /\bsomeone\b/,
    /\bacross\b/,
  ]);
  const hasWorkPowerContext = hasAny(text, [
    /\bmanager\b/,
    /\bboss\b/,
    /\bsupervisor\b/,
    /\bteam lead\b/,
  ]);
  const hasFriendContext = args.category === 'friendship' || hasAny(text, [/\bfriend\b/, /\bbest friend\b/]);
  const hasConcreteNegativeAction = hasAny(text, [
    /\bblocked me\b/,
    /\bunfollowed me\b/,
    /\bremoved me\b/,
    /\bsaid (?:she|he|they) (?:is|are|was|were) not interested\b/,
    /\btold me (?:she|he|they) (?:is|are|was|were) not interested\b/,
  ]);
  const hasApology = hasAny(text, [
    /\bsorry\b/,
    /\bapolog(?:y|ized|ised|ize|ise)\b/,
  ]);
  const hasExplanation = hasAny(text, [
    /\bexplained\b/,
    /\bbecause\b/,
    /\bsaid .{0,30}\b(?:tired|busy|overwhelmed|overwhelming|work)\b/,
    /\bwork (?:was|is) (?:overwhelming|crazy|busy)\b/,
    /\boverwhelming\b/,
  ]);
  const hasMixedConsistency = hasAny(text, [
    /\binconsistent\b/,
    /\bone day\b.*\bnext day\b/,
    /\bhot and cold\b/,
    /\bmixed signals?\b/,
  ]);
  const hasInPersonPositive = hasAny(text, [
    /\bnice in person\b/,
    /\bgood in person\b/,
    /\blong replies in person\b/,
    /\bnice when we meet\b/,
    /\bin person\b.*\bnice\b/,
    /\bin person\b.*\bgood\b/,
  ]);
  const hasTextingNegative = hasAny(text, [
    /\bbad at texting\b/,
    /\bdry over text\b/,
    /\bdry as hell over text\b/,
    /\bdoes not text\b/,
    /\bdoesnt text\b/,
    /\bnot texting\b/,
    /\bonly after midnight\b/,
    /\bonly texts? me .{0,20}(?:midnight|am|pm)\b/,
    /\bstopped replying\b/,
    /\bleft me on read\b/,
    /\bleft me on delivered\b/,
    /\bnever replies\b/,
    /\bhas not used it\b/,
    /\bhasnt used it\b/,
    /\bslow.{0,20}text/,
  ]);
  const hasSpecificPlan = hasAny(text, [
    /\bbooked\b/,
    /\bpicked\b/,
    /\breservation\b/,
    /\bfriday\b/,
    /\bsaturday\b/,
    /\bsunday\b/,
    /\bweekend\b/,
    /\b\d+\s*(?:am|pm)\b/,
    /\b(?:dinner|drinks) (?:on|at)\b/,
  ]);
  const hasTimeOrDate = hasSpecificPlan || hasLateNightTiming || hasAny(text, [
    /\b\d+ (?:days?|hours?|weeks?)\b/,
    /\bfull week\b/,
    /\bwhole week\b/,
  ]);
  const hasUserConclusion = hasAny(text, [
    /\bi think\b/,
    /\bdoes this mean\b/,
    /\bam i\b/,
    /\bwe so\b/,
    /\bmust mean\b/,
    /\bi am wondering\b/,
    /\bi do not know\b/,
    /\bdo not know if\b/,
  ]);
  const hasDeliveredNoReply = hasAny(text, [
    /\bleft me on delivered\b/,
    /\bdelivered for \d+ (?:hours?|days?)\b/,
    /\bon delivered for \d+ (?:hours?|days?)\b/,
  ]);
  const hasActiveOnSocial = hasAny(text, [
    /\bviewed (?:my )?(?:instagram )?story\b/,
    /\bwatched (?:my |every |all )?(?:instagram )?stor(?:y|ies)\b/,
    /\bwatch(?:es|ing)? every stor(?:y|ies)\b/,
    /\bkeeps watching\b/,
    /\bkeeps liking .{0,30}stor(?:y|ies)\b/,
    /\blik(?:e|ed|es|ing) .{0,30}stor(?:y|ies)\b/,
    /\bposted\b/,
    /\bposts normally\b/,
    /\bposted from\b/,
    /\breacted to my story\b/,
    /\bfollowed me back\b/,
    /\bviewed my profile\b/,
    /\bprofile\b.*\bdid not follow\b/,
  ]);
  const hasCanceledPlan = hasAny(text, [
    /\bcanceled\b/,
    /\bcanceled .{0,40}\bplans?\b/,
    /\bcanceled .{0,40}\bdinner\b/,
    /\bcanceled last minute\b/,
    /\btoo tired to meet\b/,
    /\btoo tired to hang out\b/,
  ]);
  const hasExcuse = hasAny(text, [
    /\bbecause .{0,50}\b(?:tired|busy|sick|work|overwhelmed|overwhelming)\b/,
    /\btoo tired\b/,
    /\bwas tired\b/,
    /\bshe was tired\b/,
    /\bhe was tired\b/,
    /\bwork is crazy\b/,
    /\bbusy this week\b/,
  ]);
  const hasContradictorySocialPost =
    hasCanceledPlan &&
    hasAny(text, [
      /\bthen posted\b/,
      /\bposted .{0,60}\b(?:bar|party|with someone else|other people)\b/,
      /\bwent out with other people\b/,
      /\bwent out with other\b/,
      /\bposted from a party\b/,
      /\bposted from a bar\b/,
    ]);
  const hasRepeatedBehavior = hasAny(text, [
    /\bkeeps\b/,
    /\bevery time\b/,
    /\balways\b/,
    /\brepeatedly\b/,
    /\bthree times\b/,
    /\btwice\b/,
  ]);
  const hasOddGiftOrObject = hasAny(text, [
    /\borange\b/,
    /\bgift\b/,
    /\bgifts\b/,
    /\bweird little\b/,
    /\bsingle unpeeled\b/,
    /\bporch\b/,
    /\bstray cat\b/,
    /\breturning my cat\b/,
  ]);
  const hasNeighborContext = hasAny(text, [
    /\bneighbor\b/,
    /\bneighbour\b/,
    /\bporch\b/,
    /\breturning my (?:stray )?cat\b/,
  ]);
  const hasWorkCriticism = hasAny(text, [
    /\bcritical performance review\b/,
    /\bperformance review\b/,
    /\bcriticized me\b/,
    /\bhighly critical\b/,
    /\bgave me no raise\b/,
    /\bno raise\b/,
    /\bextra work\b/,
  ]);
  const hasPrivateReassurance = hasAny(text, [
    /\bpraised me privately\b/,
    /\bpulled me aside\b/,
    /\btold me in secret\b/,
    /\bapologized for being harsh\b/,
    /\bapologised for being harsh\b/,
    /\bonly person (?:he|she|they) trusts?\b/,
  ]);
  const hasPromotionSignal = hasAny(text, [
    /\bpromotion\b/,
    /\btake over (?:his|her|their) role\b/,
    /\bnext year\b/,
    /\bhave potential\b/,
    /\bpromoted\b/,
    /\braise\b/,
  ]);
  const hasIgnoredImportantEvent = hasAny(text, [
    /\bignored me\b/,
    /\bcompletely ignored me\b/,
    /\bbirthday dinner\b/,
    /\bmy birthday\b/,
    /\bforgot my birthday\b/,
    /\bremembered everyone else\b/,
  ]);
  const hasDeflection = hasAny(text, [
    /\btoo sensitive\b/,
    /\bunsupportive\b/,
    /\bstarted crying\b/,
    /\bsaid i was being\b/,
    /\bmade it about\b/,
  ]);
  const hasUserForcedToApologize = hasAny(text, [
    /\bmade me apologize\b/,
    /\bmade me apologise\b/,
    /\bi apologized to (?:her|him|them)\b/,
    /\bi apologised to (?:her|him|them)\b/,
  ]);
  const hasFormalWorkAmbiguity =
    hasWorkPowerContext &&
    (hasWorkCriticism || hasPrivateReassurance || hasPromotionSignal) &&
    hasAny(text, [
      /\bquietly fired\b/,
      /\bgroomed for a promotion\b/,
      /\bperformance review\b/,
      /\bpraised me privately\b/,
      /\bcriticized me\b/,
      /\btake over (?:his|her|their) role\b/,
      /\bgave me no raise\b/,
      /\bextra work\b/,
      /\bpromotion\b/,
    ]);

  const factValues: Array<[SemanticFactId, boolean]> = [
    ['hasInvitation', hasInvitation],
    ['hasSpecificPlan', hasSpecificPlan],
    ['hasTimeOrDate', hasTimeOrDate],
    ['hasNoFollowThrough', hasNoFollowThrough],
    ['hasDelayedReply', hasDelayedReply],
    ['hasGhosting', hasGhosting],
    ['hasLateNightTiming', hasLateNightTiming],
    ['hasLateNightReply', hasLateNightReply],
    ['hasSocialMediaSignal', hasSocialMediaSignal],
    ['hasStrangerSignal', hasStrangerSignal],
    ['hasEyeContact', hasEyeContact],
    ['hasWorkPowerContext', hasWorkPowerContext],
    ['hasFriendContext', hasFriendContext],
    ['hasConcreteNegativeAction', hasConcreteNegativeAction],
    ['hasApology', hasApology],
    ['hasExplanation', hasExplanation],
    ['hasMixedConsistency', hasMixedConsistency],
    ['hasInPersonPositive', hasInPersonPositive],
    ['hasTextingNegative', hasTextingNegative],
    ['hasQuestionForAvailability', hasQuestionForAvailability],
    ['hasUserConclusion', hasUserConclusion],
    ['hasDinnerContext', hasDinnerContext],
    ['hasDeliveredNoReply', hasDeliveredNoReply],
    ['hasActiveOnSocial', hasActiveOnSocial],
    ['hasCanceledPlan', hasCanceledPlan],
    ['hasExcuse', hasExcuse],
    ['hasContradictorySocialPost', hasContradictorySocialPost],
    ['hasRepeatedBehavior', hasRepeatedBehavior],
    ['hasOddGiftOrObject', hasOddGiftOrObject],
    ['hasNeighborContext', hasNeighborContext],
    ['hasWorkCriticism', hasWorkCriticism],
    ['hasPrivateReassurance', hasPrivateReassurance],
    ['hasPromotionSignal', hasPromotionSignal],
    ['hasIgnoredImportantEvent', hasIgnoredImportantEvent],
    ['hasDeflection', hasDeflection],
    ['hasUserForcedToApologize', hasUserForcedToApologize],
    ['hasFormalWorkAmbiguity', hasFormalWorkAmbiguity],
  ];

  factValues.forEach(([factId, isActive]) => {
    if (isActive) {
      activeFactIds.push(factId);
    }
  });

  return buildFacts(activeFactIds);
}

export function findSemanticScenarioOverride(
  facts: SemanticFacts,
  category: Category,
): ScenarioOverride | undefined {
  if (facts.hasFormalWorkAmbiguity) {
    return {
      id: 'workplace_mixed_performance_signal',
      category,
      requiredSignalIds: [],
      priority: 1100,
      scoreFloor: 38,
      scoreCeiling: 55,
      explanationTemplates: [
        'This is workplace ambiguity, not a clean personal signal. The positive or informal piece matters, but it needs concrete follow-through before you trust it.',
        'Mixed work signals need paperwork more than interpretation. Any promise, praise, or informal invite needs a clear next step before it becomes solid.',
      ],
      nextMoveTemplates: [
        'Ask for clear expectations and a timeline in writing. Do not guess from private reassurance alone.',
        'Get the role expectations, next steps, and any advancement path documented before treating this as a promise.',
      ],
    };
  }

  if (facts.hasConcreteNegativeAction) {
    return {
      id: 'clear_negative_action_closure',
      category,
      requiredSignalIds: [],
      priority: 1000,
      scoreFloor: 24,
      scoreCeiling: 36,
      explanationTemplates: [
        'That is concrete negative action. The part to stop analyzing is the why, not whether the signal is clear.',
        'This is not a subtle clue. The boundary is clear, even if the reason feels unfinished.',
      ],
      nextMoveTemplates: [
        'Do not investigate the reason. Treat the boundary as closure and leave it alone.',
        'Take the boundary literally and do not turn closure into a research project.',
      ],
    };
  }

  if (
    facts.hasActiveOnSocial &&
    (facts.hasDeliveredNoReply ||
      facts.hasNoFollowThrough ||
      facts.hasDelayedReply ||
      facts.hasTextingNegative)
  ) {
    return {
      id: 'active_on_social_but_not_replying',
      category,
      requiredSignalIds: [],
      priority: 940,
      scoreFloor: 65,
      scoreCeiling: 78,
      explanationTemplates: [
        'They are active enough online, but not giving you a direct reply. That is a signal, but still not a full verdict.',
        'Social activity while your message sits unanswered is worth noticing. It is still weaker than an actual response.',
      ],
      nextMoveTemplates: [
        'Do not chase the app activity. Wait for an actual reply or treat the silence as the answer for now.',
        'Let the direct reply matter more than the app activity around it.',
      ],
    };
  }

  if (facts.hasCanceledPlan && facts.hasExcuse && facts.hasContradictorySocialPost) {
    return {
      id: 'canceled_plan_then_conflicting_post',
      category,
      requiredSignalIds: [],
      priority: 930,
      scoreFloor: 56,
      scoreCeiling: 70,
      explanationTemplates: [
        'Canceling because of an excuse and then showing up socially elsewhere does not prove betrayal, but it does make the excuse look shaky.',
        'The canceled plan is real, and the later social activity gives the excuse less clean cover. It is suspicious, not a completed trial.',
      ],
      nextMoveTemplates: [
        'Ask once calmly if it matters to you. Do not prosecute the post like evidence in court.',
        'Name the mismatch directly once, then watch whether the pattern repeats.',
      ],
    };
  }

  if (
    facts.hasFriendContext &&
    facts.hasIgnoredImportantEvent &&
    facts.hasDeflection &&
    (facts.hasUserForcedToApologize || facts.hasNoFollowThrough)
  ) {
    return {
      id: 'friendship_conflict_deflection_silence',
      category,
      requiredSignalIds: [],
      priority: 920,
      scoreFloor: 34,
      scoreCeiling: 52,
      explanationTemplates: [
        'You are not inventing the hurt. Being ignored at an important moment, having it flipped back on you, and then getting silence is a real friendship issue.',
        'The concern is grounded here. The problem is the ignored moment, the deflection, and whether they can own any part of it.',
      ],
      nextMoveTemplates: [
        'Do not keep apologizing to fix the tension. Ask for a direct conversation once, then watch whether they own their part.',
        'Give it one calm conversation, not unlimited repair work from your side.',
      ],
    };
  }

  if (facts.hasRepeatedBehavior && facts.hasOddGiftOrObject && (facts.hasNeighborContext || category === 'general')) {
    return {
      id: 'repeated_odd_gesture',
      category,
      requiredSignalIds: [],
      priority: 910,
      scoreFloor: 45,
      scoreCeiling: 62,
      explanationTemplates: [
        'The repeated behavior is real. The odd object is weird, but weird is not automatically romantic, threatening, or meaningful.',
        'There is a pattern here, and the extra object makes it unusual. Unusual still needs a direct explanation before it becomes lore.',
      ],
      nextMoveTemplates: [
        'Ask directly about the odd part before assigning it a whole story.',
        'Treat the pattern as worth clarifying, not worth decoding in private forever.',
      ],
    };
  }

  if (category === 'romance' && facts.hasWorkPowerContext && facts.hasInvitation && facts.hasDinnerContext) {
    return {
      id: 'work_power_invitation',
      category,
      requiredSignalIds: [],
      priority: 900,
      scoreFloor: 48,
      scoreCeiling: 55,
      explanationTemplates: [
        'Dinner is concrete action, but because it is your manager, do not treat this like a normal romance signal.',
        'A manager inviting you to dinner is real action with power-context attached. That makes it sensitive, not simple.',
      ],
      nextMoveTemplates: [
        'Keep it professional unless the context is clearly appropriate and you actually want that dynamic.',
        'Do not turn this into a normal romance read until the work boundary is clearly safe.',
      ],
    };
  }

  if (
    category === 'romance' &&
    facts.hasInvitation &&
    facts.hasDinnerContext &&
    facts.hasQuestionForAvailability &&
    facts.hasNoFollowThrough
  ) {
    return {
      id: 'dinner_interest_no_followthrough',
      category,
      requiredSignalIds: [],
      priority: 850,
      scoreFloor: 58,
      scoreCeiling: 66,
      explanationTemplates: [
        'The dinner interest is real evidence, but disappearing when it was time to pick a date weakens it.',
        'Saying yes to dinner counts, but stopping when availability came up is the part that matters.',
      ],
      nextMoveTemplates: [
        'Send one clean follow-up if you want, then stop chasing the idea.',
        'Do not chase the idea. Wait for an actual time or leave it there.',
      ],
    };
  }

  if (facts.hasInvitation && facts.hasNoFollowThrough && facts.hasQuestionForAvailability) {
    return {
      id: 'soft_invite_no_followthrough',
      category,
      requiredSignalIds: [],
      priority: 840,
      scoreFloor: 62,
      scoreCeiling: 74,
      explanationTemplates: [
        'The invite idea is real evidence, but it gets weaker when picking an actual day turns into silence.',
        'Saying “we should” is easy. The missing follow-through after you asked for timing is the part that matters.',
      ],
      nextMoveTemplates: [
        'Send one clean follow-up if you want, then stop carrying the plan by yourself.',
        'Wait for them to help make the plan real before treating the interest as solid.',
      ],
    };
  }

  if (facts.hasGhosting && facts.hasDelayedReply && facts.hasLateNightReply) {
    return {
      id: 'late_night_reentry_after_silence',
      category,
      requiredSignalIds: [],
      priority: 800,
      scoreFloor: 78,
      scoreCeiling: 84,
      explanationTemplates: [
        'A week of silence followed by a 1am reply is not premium effort. That is re-entry, not consistency.',
        'Being left on read for a week matters more than the 1am comeback. Late timing does not make it deeper.',
      ],
      nextMoveTemplates: [
        'Respond only if you want, but do not reward low-effort timing with a full storyline.',
        'Wait for consistent daytime effort before treating the re-entry like progress.',
      ],
    };
  }

  if (facts.hasMixedConsistency && facts.hasInPersonPositive && facts.hasTextingNegative) {
    return {
      id: 'mixed_consistency_text_inperson',
      category,
      requiredSignalIds: [],
      priority: 760,
      scoreFloor: 71,
      scoreCeiling: 76,
      explanationTemplates: [
        'This is mixed-signal territory. Nice in person matters, but inconsistent texting means the pattern is not stable.',
        'The good in-person energy counts, but bad texting and day-to-day inconsistency keep this from being solid.',
      ],
      nextMoveTemplates: [
        'Watch consistency, not the best moments. If the effort stays uneven, believe the pattern.',
        'Look for repeated effort across settings before upgrading this.',
      ],
    };
  }

  if (category === 'friendship' && facts.hasFriendContext && facts.hasInvitation && facts.hasLateNightTiming) {
    return {
      id: 'late_night_friend_invite',
      category,
      requiredSignalIds: [],
      priority: 740,
      scoreFloor: 48,
      scoreCeiling: 58,
      explanationTemplates: [
        'An 11pm hangout is a little loaded, but it is still an invite, not a confession.',
        'Late-night plans can blur the vibe. In friendship context, this is ambiguous before it is romantic.',
      ],
      nextMoveTemplates: [
        'Ask what the plan is, or suggest a normal-time hangout if you want clarity.',
        'Clarify the setting before turning the time into a whole theory.',
      ],
    };
  }

  if (category !== 'friendship' && facts.hasEyeContact && facts.hasStrangerSignal) {
    return {
      id: 'stranger_eye_contact',
      category,
      requiredSignalIds: [],
      priority: 720,
      scoreFloor: 64,
      scoreCeiling: 70,
      explanationTemplates: [
        'Looking or eye contact can be interest, but from someone in a public setting, it is still mostly vibes.',
        'Repeated looks in a public setting can be a signal to notice, not enough to build a case on by itself.',
      ],
      nextMoveTemplates: [
        'Do not build a story unless there is an approach, conversation, or repeated effort.',
        'Let the looking stay a light signal unless someone actually makes a move.',
      ],
    };
  }

  if (category === 'romance' && facts.hasLateNightTiming && facts.hasNoFollowThrough) {
    return {
      id: 'late_night_texting_no_plans',
      category,
      requiredSignalIds: [],
      priority: 700,
      scoreFloor: 72,
      scoreCeiling: 80,
      explanationTemplates: [
        'Late-night texting without real plans is attention, not consistency. The timing is doing more work than the effort.',
        'After-midnight contact can feel charged, but no real plan keeps this in low-effort territory.',
      ],
      nextMoveTemplates: [
        'Do not reward late timing with a full storyline. Look for daytime effort and actual plans.',
        'Treat the texts as casual until they come with real logistics.',
      ],
    };
  }

  return undefined;
}
