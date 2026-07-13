export type CaseSafetyReason = 'imminent_violence' | 'self_harm' | 'coercive_control' | 'stalking';

export interface CaseSafetyAssessment {
  shouldRoute: boolean;
  reason: CaseSafetyReason | null;
}

export const CASE_SAFETY_MESSAGE =
  "Overthought won’t score or roast this situation. If you may be in immediate danger or might hurt yourself, contact local emergency services now. If you can do so safely, reach out to someone you trust and ask them to stay with you.";

const ACTOR = String.raw`(?:he|she|they|my\s+(?:partner|boyfriend|girlfriend|husband|wife|ex)|the\s+person)`;
const VIOLENT_ACTION = String.raw`(?:kill|murder|shoot|stab|hurt|choke|strangle|beat\s+up)`;

// First-person intent ("I wanna/gonna/will/plan to ...") with the negation captured
// so refusals like "I don't wanna hurt him" never route. Negation is the only
// capturing group in these patterns; matching relies on that.
const FIRST_PERSON_NEGATION = String.raw`(?:do\s*not|don'?t|never|won'?t|wouldn'?t|would\s+never|could\s+never|not)`;
const FIRST_PERSON_INTENT_HEAD = String.raw`i\s+(${FIRST_PERSON_NEGATION}\s+)?(?:want\s+to|wanna|wana|plan(?:ning)?\s+to|intend\s+to|need\s+to)|i(?:'m|\s+am)\s+(${FIRST_PERSON_NEGATION}\s+)?(?:going\s+to|gonna|gunna|about\s+to|planning\s+to|trying\s+to)|i(?:'ll|\s+will)\s+(${FIRST_PERSON_NEGATION}\s+)?|i'?m?ma\s+(${FIRST_PERSON_NEGATION}\s+)?`;
const INTENT_FILLER = String.raw`(?:(?:really|literally|actually|honestly|seriously|just|so)\s+){0,2}`;

const SELF_HARM_TARGET = String.raw`(?:kill\s+myself|die|end\s+my\s+life|take\s+my\s+life|hurt\s+myself|unalive\s+myself|off\s+myself)`;
const FIRST_PERSON_SELF_HARM_PATTERN = new RegExp(
  String.raw`\b(?:${FIRST_PERSON_INTENT_HEAD})\s*${INTENT_FILLER}${SELF_HARM_TARGET}\b`,
  'gi',
);

// "I don't want to live" is a danger signal, not a negated intent; the lookahead
// keeps ordinary living-arrangement phrasing ("live with my ex") on the normal path.
const HOPELESSNESS_PATTERN =
  /\bi\s+(?:do\s*not|don'?t)\s+want\s+to\s+(?:live|be\s+alive|exist)\b(?!\s+(?:with|in|at|near|by|there|together|alone|here|like))/i;

const RECENT_SELF_INJURY_PATTERN =
  /\bi\s+(?:cut|hurt|injured)\s+myself\b.{0,80}\b(?:today|tonight|right now|cannot stop|can't stop|do not think i can stop|don't think i can stop)\b/i;

const ENTERTAINMENT_OR_JOKE_PATTERN = /\b(?:song|lyrics?|movie|quote|quoted|joke|joked|joking|kidding|kill bill)\b/i;
const CONCRETE_SELF_HARM_MARKER =
  /\b(?:pills? ready|have pills|tonight|right now|planning to|going to|cannot stop|can't stop|do not think i can stop|don't think i can stop)\b/i;

const VIOLENCE_TARGET = String.raw`(?:him|her|them|you|(?:this|that)\s+(?:guy|girl|man|woman|dude)|my\s+(?:ex|partner|boyfriend|girlfriend|husband|wife|best\s+friend|friend|roommate|mom|dad|mother|father|brother|sister|coworker|boss)|everyone|everybody|someone|somebody)`;
const FIRST_PERSON_VIOLENCE_PATTERN = new RegExp(
  String.raw`\b(?:${FIRST_PERSON_INTENT_HEAD})\s*${INTENT_FILLER}${VIOLENT_ACTION}\s+${VIOLENCE_TARGET}\b`,
  'gi',
);
const CONCRETE_VIOLENCE_MARKER = /\b(?:tonight|today|right now)\b/i;

const THREAT_PATTERN = new RegExp(
  String.raw`\b${ACTOR}\b.{0,70}\b(?:said|says|told me|threatened?|threatens?)\b.{0,70}\b${VIOLENT_ACTION}\s+me\b`,
  'i',
);
const DIRECT_ASSAULT_PATTERN = new RegExp(
  String.raw`\b${ACTOR}\b.{0,30}\b(?:hit|hits|beat|beats|choked?|chokes|strangled?|strangles|stabbed?|stabs|shot|attacked?)\s+me\b`,
  'i',
);

const COERCIVE_CONTROL_PATTERNS = [
  new RegExp(
    String.raw`\b${ACTOR}\b.{0,100}\b(?:won't|will not|doesn't|does not)\s+let me leave\b`,
    'i',
  ),
  /\blocks? me (?:inside|in)\b.{0,80}\b(?:threatens?|threatened)\s+me\b/i,
  /\bcontrols? (?:all )?my money\b.{0,100}\b(?:takes? my phone|won't let me leave|will not let me leave)\b/i,
];

const STALKING_PATTERNS = [
  new RegExp(
    String.raw`\b${ACTOR}\b.{0,50}\bfollows? me home\b.{0,100}\b(?:shows? up|told (?:him|her|them) to stop|told (?:him|her|them) not to contact me)\b`,
    'i',
  ),
  /\b(?:put|placed|hid) (?:a )?tracker on my (?:car|phone|bag)\b/i,
  /\bwaiting outside (?:my )?(?:home|house|apartment|work)\b.{0,100}\b(?:again|told (?:him|her|them) to stop|told (?:him|her|them) not to contact me)\b/i,
];

function hasAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

// Routes only when at least one occurrence has no captured negation, so
// "I don't wanna hurt him but I wanna kill him" still routes on the second clause.
function hasUnnegatedIntentMatch(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  let match = pattern.exec(value);
  while (match) {
    if (!match.slice(1).some((group) => group !== undefined)) {
      pattern.lastIndex = 0;
      return true;
    }
    match = pattern.exec(value);
  }
  return false;
}

function normalizeSafetyInput(inputText: string): string {
  return inputText
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function assessCaseSafety(inputText: string): CaseSafetyAssessment {
  const normalized = normalizeSafetyInput(inputText);

  if (!normalized) {
    return { shouldRoute: false, reason: null };
  }

  const selfHarmMatch =
    hasUnnegatedIntentMatch(FIRST_PERSON_SELF_HARM_PATTERN, normalized) ||
    HOPELESSNESS_PATTERN.test(normalized) ||
    RECENT_SELF_INJURY_PATTERN.test(normalized);

  if (
    selfHarmMatch &&
    (!ENTERTAINMENT_OR_JOKE_PATTERN.test(normalized) || CONCRETE_SELF_HARM_MARKER.test(normalized))
  ) {
    return { shouldRoute: true, reason: 'self_harm' };
  }

  const firstPersonViolenceMatch = hasUnnegatedIntentMatch(FIRST_PERSON_VIOLENCE_PATTERN, normalized);

  if (
    firstPersonViolenceMatch &&
    (!ENTERTAINMENT_OR_JOKE_PATTERN.test(normalized) || CONCRETE_VIOLENCE_MARKER.test(normalized))
  ) {
    return { shouldRoute: true, reason: 'imminent_violence' };
  }

  if (THREAT_PATTERN.test(normalized) || DIRECT_ASSAULT_PATTERN.test(normalized)) {
    return { shouldRoute: true, reason: 'imminent_violence' };
  }

  if (hasAnyPattern(normalized, COERCIVE_CONTROL_PATTERNS)) {
    return { shouldRoute: true, reason: 'coercive_control' };
  }

  if (hasAnyPattern(normalized, STALKING_PATTERNS)) {
    return { shouldRoute: true, reason: 'stalking' };
  }

  return { shouldRoute: false, reason: null };
}

export class CaseSafetyRoutingError extends Error {
  readonly reason: CaseSafetyReason;

  constructor(reason: CaseSafetyReason) {
    super(CASE_SAFETY_MESSAGE);
    this.name = 'CaseSafetyRoutingError';
    this.reason = reason;
  }
}
