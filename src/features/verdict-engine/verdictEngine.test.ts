import { analyzeCase, verdictConfig } from './index';
import type { Category } from './types';
import { getVerdictDisplayLabel, verdictLabels } from '../../shared/utils/verdict';

interface GoldenCase {
  name: string;
  category: Category;
  inputText: string;
  minScore: number;
  maxScore: number;
  verdictLabel:
    | 'barely_delusional'
    | 'slight_reach'
    | 'mild_delusion'
    | 'dangerous_overthinking'
    | 'full_clown_territory';
  explanationPattern: RegExp;
  forbiddenExplanationPattern?: RegExp;
  expectedScenarioId?: string;
}

const goldenCases: GoldenCase[] = [
  {
    name: 'The Ghost Town',
    category: 'romance',
    inputText:
      "He liked my Instagram story from three weeks ago, but he hasn't texted me back since we matched.",
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /digital crumbs|thumb slip|not romance/i,
  },
  {
    name: 'The Green Flag',
    category: 'romance',
    inputText:
      "She texted me 'I had a great time, let's get dinner on Friday' and she actually booked the reservation.",
    minScore: 0,
    maxScore: 12,
    verdictLabel: 'barely_delusional',
    explanationPattern: /booked|logistics|guaranteed date|opening this app/i,
  },
  {
    name: 'The Polite Flake',
    category: 'friendship',
    inputText:
      "I asked if they wanted to hang out and they just replied 'maybe sometime next week haha' and never texted again.",
    minScore: 80,
    maxScore: 85,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /maybe sometime|let this conversation die|peacefully/i,
  },
  {
    name: 'The Main Character',
    category: 'social',
    inputText:
      'Everyone at the party was looking at me, I think this must mean they all want to be my best friend.',
    minScore: 86,
    maxScore: 95,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /main character|on fire|best friend/i,
  },
  {
    name: 'The Good Coworker',
    category: 'general',
    inputText: 'My coworker checks in every morning and always asks how my current project is going.',
    minScore: 40,
    maxScore: 50,
    verdictLabel: 'mild_delusion',
    explanationPattern: /bonus|project|micromanagement|meet-cute/i,
  },
  {
    name: 'The Hot and Cold',
    category: 'romance',
    inputText:
      "He texts me every single day without fail, but whenever I ask to hang out in person he says he's really busy with work right now.",
    minScore: 80,
    maxScore: 85,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /emotional support chatbot|time for coffee|don't want to/i,
  },
  {
    name: 'The HR Violation',
    category: 'romance',
    inputText:
      'My manager always buys me coffee when we have our 1-on-1 meetings and smiles at me a lot. Does this mean they are into me?',
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /corporate card|courtship|iced latte|boss/i,
  },
  {
    name: 'The Secure Attachment',
    category: 'friendship',
    inputText:
      'My best friend left me on read for two days after I sent them a TikTok. Are we no longer friends?',
    minScore: 75,
    maxScore: 85,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /tiktok|court summons|48 hours|touch grass/i,
  },
  {
    name: 'The Slow Burn',
    category: 'romance',
    inputText:
      "She remembered my dog's birthday and asked about him, but it took her 14 hours to reply to my last text.",
    minScore: 60,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /dog|golden retriever|middleman|animal/i,
  },
  {
    name: 'The Crowd Control',
    category: 'social',
    inputText:
      'He invited me to his birthday party, but he invited the entire office, so I think he really wants me there.',
    minScore: 86,
    maxScore: 92,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /not exclusively chosen|warm body|free cake|targeted strike/i,
  },
  {
    name: 'The Zombie Breadcrumb',
    category: 'romance',
    inputText:
      "We hooked up for six months, then he ghosted me. Today he replied to my IG story with the fire emoji and said 'long time no see'.",
    minScore: 80,
    maxScore: 88,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /fire emoji|ghosting|romantic revival|door is still unlocked/i,
  },
  {
    name: 'The Hostage Situation',
    category: 'romance',
    inputText:
      "He didn't ask me a single question about myself, but he paid for a $300 dinner and talked about his crypto portfolio all night.",
    minScore: 72,
    maxScore: 80,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /captive audience|financial podcast|crypto/i,
  },
  {
    name: 'The Brain Rot',
    category: 'romance',
    inputText: 'left me on delivered for 3 days but then liked my bereal. we so back???',
    minScore: 92,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /bereal|72 hours|complete silence|not back/i,
  },
  {
    name: 'The Blank Slate',
    category: 'general',
    inputText: 'eye contact across the bar.',
    minScore: 85,
    maxScore: 92,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /legal case|accidentally looking|general direction/i,
  },
  {
    name: 'The Copy-Routing Check',
    category: 'romance',
    inputText:
      'My boss always pays for my lunch when we meet to discuss my KPIs and smiles at me. Is there a spark?',
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /corporate card, not a courtship/i,
  },
  {
    name: 'The Instagram Post Crumb',
    category: 'romance',
    inputText: 'I was left on read for a whole week, but he just liked my newest instagram post.',
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /instagram|post|left on read|not romance|crumb/i,
  },
  {
    name: 'The Meeting Eye Contact',
    category: 'general',
    inputText: 'We made eye contact for like 3 seconds during a meeting.',
    minScore: 85,
    maxScore: 92,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /legal case|eye contact|general direction|meeting/i,
  },
  {
    name: 'The Promotion Lunch',
    category: 'general',
    inputText: 'My manager bought me lunch to talk about my promotion.',
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /corporate card, not a courtship/i,
  },
  {
    name: 'The Actions vs Words',
    category: 'romance',
    inputText:
      "He said he's not looking for anything serious, but he texts me good morning every single day, remembered my coffee order, and introduced me to his sister.",
    minScore: 95,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /terms and conditions|loopholes|fine print/i,
    expectedScenarioId: 'explicit_rejection_overrides_actions',
  },
  {
    name: 'The One-Sided Wallet',
    category: 'romance',
    inputText:
      "I always drive 45 minutes to his house, pay for our takeout, and he still hasn't asked me to be his girlfriend after 8 months.",
    minScore: 92,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /free delivery driver and ATM|financial investment|relationship/i,
    expectedScenarioId: 'one_sided_effort_trap',
  },
  {
    name: 'The Pity Invite',
    category: 'social',
    inputText:
      "I asked what everyone was doing for the weekend in the group chat, and he replied 'having a few people over for drinks, you can come if you want'.",
    minScore: 85,
    maxScore: 95,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /afterthought, not an invitation|holding the door open|sent for you/i,
    expectedScenarioId: 'the_pity_invite',
  },
  {
    name: 'The Actions vs Words Fix Check',
    category: 'romance',
    inputText:
      'She told me she just wants to be friends, but she always replies to my Snapchat stories immediately and sends heart emojis.',
    minScore: 95,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /terms and conditions|loopholes|fine print/i,
    expectedScenarioId: 'explicit_rejection_overrides_actions',
  },
  {
    name: 'The Not Ready Disclaimer',
    category: 'romance',
    inputText:
      "He told me he isn't ready for a relationship right now, but he literally called me at 2AM to talk about his feelings.",
    minScore: 95,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /terms and conditions|loopholes|fine print/i,
    expectedScenarioId: 'explicit_rejection_overrides_actions',
  },
  {
    name: 'The Flying Grocery Wallet',
    category: 'romance',
    inputText:
      "I've been flying out to see her for almost a year and buying all our groceries, but she still introduces me as her friend.",
    minScore: 92,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /free delivery driver and ATM|financial investment|relationship/i,
    expectedScenarioId: 'one_sided_effort_trap',
  },
  {
    name: 'The Reverse Disclaimer',
    category: 'romance',
    inputText:
      "He asked me on a proper dinner date for Friday and booked a table, and I just replied 'sure, I guess I can make that work'.",
    minScore: 0,
    maxScore: 15,
    verdictLabel: 'barely_delusional',
    explanationPattern: /asked you out|handled logistics|plan|booked/i,
    expectedScenarioId: 'green_flag_booked_date',
  },
  {
    name: 'The Reverse Disclaimer 8pm',
    category: 'romance',
    inputText: 'He booked us a table for 8pm. I just replied sure, maybe I can make that work,',
    minScore: 0,
    maxScore: 15,
    verdictLabel: 'barely_delusional',
    explanationPattern: /asked you out|handled logistics|plan|booked/i,
    expectedScenarioId: 'green_flag_booked_date',
  },
  {
    name: 'The Gender-Neutral Booked Date',
    category: 'romance',
    inputText:
      "He actually booked us a table for 8pm on Saturday. I didn't want to seem too eager so I just said sure maybe I can make that work.",
    minScore: 0,
    maxScore: 15,
    verdictLabel: 'barely_delusional',
    explanationPattern: /They explicitly asked you out|They said dinner|handled logistics|booked/i,
    forbiddenExplanationPattern: /\b[Ss]he\b|\b[Hh]e\b/,
    expectedScenarioId: 'green_flag_booked_date',
  },
  {
    name: 'The Driving Takeout Wallet',
    category: 'romance',
    inputText:
      "I've been driving out to his place and paying for our takeout for like 6 months, and he still won't call me his girlfriend.",
    minScore: 92,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /free delivery driver and ATM|paying for things|relationship/i,
    expectedScenarioId: 'one_sided_effort_trap',
  },
  {
    name: 'The Good Morning Story Dodge',
    category: 'romance',
    inputText:
      "She always likes my instagram stories instantly and texts me good morning, but whenever I ask to meet up she says she's really busy with work.",
    minScore: 80,
    maxScore: 88,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /emotional support chatbot|time for coffee|don't want to|work excuse wall/i,
    expectedScenarioId: 'daily_texting_no_in_person',
  },
  {
    name: 'Strong Evidence With Minor Delay',
    category: 'romance',
    inputText:
      'She planned the date, picked the place, texted me "I had a really good time," and asked if I’m free next Saturday, but she took 6 hours to reply today. Am I overthinking?',
    minScore: 15,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /grounded|slow reply|planned next date|six hours|clear positive language/i,
    expectedScenarioId: 'strong_followup_minor_delay',
  },
  {
    name: 'Daily Texting But Avoids Meeting Exact',
    category: 'romance',
    inputText:
      'He texts me good morning every day and keeps the conversation going, but every time I ask to meet up he says his schedule is crazy and never suggests another day.',
    minScore: 80,
    maxScore: 88,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /emotional support chatbot|time for coffee|don't want to|work excuse wall/i,
    expectedScenarioId: 'daily_texting_no_in_person',
  },
  {
    name: 'Coworker Outside Work Dinner',
    category: 'romance',
    inputText:
      'My coworker always helps me with projects and bought me coffee once, but yesterday he asked if I wanted to grab dinner after work, just the two of us.',
    minScore: 45,
    maxScore: 65,
    verdictLabel: 'mild_delusion',
    explanationPattern: /work context|dinner after work|one-on-one|coffee near the printer|actual signal/i,
    expectedScenarioId: 'coworker_outside_work_signal',
  },
  {
    name: 'Explicit Rejection With Emotional Intimacy',
    category: 'romance',
    inputText:
      'She told me she only wants something casual and is not ready for a relationship, but she calls me every night, gets jealous when I talk to other girls, and says she misses me.',
    minScore: 95,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /terms and conditions|boundary|loophole|fine print/i,
    forbiddenExplanationPattern: /good morning/i,
    expectedScenarioId: 'explicit_rejection_overrides_actions',
  },
  {
    name: 'Friendship Repair With Follow-Up',
    category: 'friendship',
    inputText:
      'My best friend didn’t reply for two days, but she later apologized and said work has been overwhelming. She also asked if we can hang out this weekend.',
    minScore: 10,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /apologized|explained the delay|offered a plan|repair|not abandonment|hang out this weekend/i,
    expectedScenarioId: 'friendship_repair_with_followup',
  },
  {
    name: 'The Some Of Us Drop By',
    category: 'romance',
    inputText:
      "I asked if he had birthday plans and he said 'yeah some of us are hitting the bars later, feel free to drop by'.",
    minScore: 85,
    maxScore: 95,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /afterthought, not an invitation|holding the door open|sent for you/i,
    expectedScenarioId: 'the_pity_invite',
  },
  {
    name: 'The Schedule Is Crazy',
    category: 'romance',
    inputText:
      'We matched 6 months ago and snapchat every day, but every time I mention getting drinks he says his schedule is crazy.',
    minScore: 80,
    maxScore: 88,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /emotional support chatbot|time for coffee|don't want to|work excuse wall|real-life plan/i,
    expectedScenarioId: 'daily_texting_no_in_person',
  },
  {
    name: 'Gen Z Ghosting Breadcrumb',
    category: 'romance',
    inputText:
      'ok so he ghosted me for like a week but now he liked my story AND sent “😭” to my selfie… am i insane or is bro spinning the block',
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /crying emoji|ghosting|comeback tour|breadcrumb|streetwear|spinning the block|low-effort/i,
    expectedScenarioId: 'gen_z_ghosting_breadcrumb',
  },
  {
    name: 'Strong Plan With Dry Reply',
    category: 'romance',
    inputText:
      'she literally said ‘i wanna see you again’ and picked saturday for dinner but she replied kinda dry today so now i’m spiraling lol',
    minScore: 10,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /dry reply|dinner plan|picked a day|saturday dinner|texting tone/i,
    expectedScenarioId: 'clear_plan_dry_text_anxiety',
  },
  {
    name: 'Party Silence Main Charactering',
    category: 'social',
    inputText:
      'i walked into the party and everyone went quiet for a sec... be honest did they hate my vibe or am i main charactering rn',
    minScore: 60,
    maxScore: 75,
    verdictLabel: 'mild_delusion',
    explanationPattern: /room going quiet|congressional hearing|vibe|awkward room beat|documentary/i,
    expectedScenarioId: 'party_silence_main_character',
  },
  {
    name: 'Project Check-In Smiley Overread',
    category: 'general',
    inputText:
      'My coworker messages me every morning asking if I finished my part of the project. They also use smiley faces. Does that mean they like me?',
    minScore: 40,
    maxScore: 50,
    verdictLabel: 'mild_delusion',
    explanationPattern: /smiley face|project check-in|office seasoning|workplace rhythm|not a confession/i,
    expectedScenarioId: 'project_checkin_smiley_overread',
  },
  {
    name: 'Clear Event Follow-Up',
    category: 'general',
    inputText:
      'Someone I met at an event asked for my number, texted me the next morning, and suggested coffee this Friday. I’m worried they were just being polite.',
    minScore: 5,
    maxScore: 20,
    verdictLabel: 'barely_delusional',
    explanationPattern: /asked for your number|followed up|suggested a time|not just politeness|logistics|coffee/i,
    expectedScenarioId: 'clear_event_followup',
  },
  {
    name: 'Gym Proximity No Words',
    category: 'general',
    inputText:
      'This person keeps ending up near me at the gym, but we’ve never talked. Yesterday they used the machine next to mine. Is that a sign?',
    minScore: 70,
    maxScore: 85,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /leg press|gym geography|machine next to yours|floor-plan logistics|until words happen/i,
    expectedScenarioId: 'gym_proximity_no_words',
  },
  {
    name: 'Typo Friendship Repair',
    category: 'friendship',
    inputText:
      'my best frend didnt reply for 2 days but she said sorry and said work was crazy n asked if we can hang this weekend, am i being dramatic',
    minScore: 15,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /apologized|explained the delay|offered a plan|repair|not abandonment|hang out this weekend/i,
    expectedScenarioId: 'friendship_repair_with_followup',
  },
  {
    name: 'Friendship One-Sided Effort',
    category: 'friendship',
    inputText:
      'i always text first and they reply nice but never ask me anything back lol are we even friends or am i forcing it',
    minScore: 65,
    maxScore: 80,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /always start|never ask anything back|effort imbalance|mutual friendship labor|conversation couch/i,
    expectedScenarioId: 'friendship_one_sided_effort',
  },
  {
    name: 'Typo Soft Decline',
    category: 'friendship',
    inputText:
      'i asked if she wana hang and she was like ‘maybe sometimee’ then never texted again... is she just busy or nah',
    minScore: 82,
    maxScore: 88,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /maybe sometime|no follow-up|scheduling issue|polite disappearing act|smoke bomb/i,
    expectedScenarioId: 'soft_decline_no_followup',
  },
  {
    name: 'Gen Z Breadcrumb Variant',
    category: 'romance',
    inputText: 'be fr he ghosted then watched my story and sent crying emoji to my selfie lowkey',
    minScore: 90,
    maxScore: 100,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /crying emoji|ghosting|comeback tour|breadcrumb|streetwear|low-effort/i,
    expectedScenarioId: 'gen_z_ghosting_breadcrumb',
  },
  {
    name: 'Strong Plan Dry Reply Variant',
    category: 'romance',
    inputText:
      'she said she wants to see you again and picked the day for dinner but the dry reply today has me spiralling',
    minScore: 10,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /dry reply|dinner plan|picked a day|saturday dinner|texting tone/i,
    expectedScenarioId: 'clear_plan_dry_text_anxiety',
  },
  {
    name: 'Typo Friendship Repair Variant',
    category: 'friendship',
    inputText:
      'my best freind didnt reply for 2 days but said sorry n asked if we can hang this weekend because work was crazy',
    minScore: 15,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /apologized|explained the delay|offered a plan|repair|not abandonment|hang out this weekend/i,
    expectedScenarioId: 'friendship_repair_with_followup',
  },
  {
    name: 'Typo Soft Decline Variant',
    category: 'friendship',
    inputText: 'asked if she wanna hang, got maybe some time, then nothing',
    minScore: 82,
    maxScore: 88,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /maybe sometime|no follow-up|scheduling issue|polite disappearing act|smoke bomb/i,
    expectedScenarioId: 'soft_decline_no_followup',
  },
  {
    name: 'Relationship Confirmation',
    category: 'romance',
    inputText:
      'Guy I went on 3 dates with just asked me to be his girlfriend. Do you think he likes me?',
    minScore: 5,
    maxScore: 15,
    verdictLabel: 'barely_delusional',
    explanationPattern: /not a mystery novel|relationship|not a signal to analyze|conclusion/i,
    expectedScenarioId: 'relationship_confirmed',
  },
  {
    name: 'Relationship Confirmation Official Variant',
    category: 'romance',
    inputText: "They asked me out officially and said we're official now.",
    minScore: 5,
    maxScore: 15,
    verdictLabel: 'barely_delusional',
    explanationPattern: /not a mystery novel|relationship|not a signal to analyze|conclusion/i,
    expectedScenarioId: 'relationship_confirmed',
  },
  {
    name: 'Relationship Confirmation Boyfriend Variant',
    category: 'romance',
    inputText: 'She asked me to be her boyfriend after our third date.',
    minScore: 5,
    maxScore: 15,
    verdictLabel: 'barely_delusional',
    explanationPattern: /not a mystery novel|relationship|not a signal to analyze|conclusion/i,
    expectedScenarioId: 'relationship_confirmed',
  },
  {
    name: 'Social Media Context Is Not A Crumb',
    category: 'romance',
    inputText:
      'She posts on her story right after I text her but doesn’t open my message for hours. But when she does reply she’s always nice. What does this mean?',
    minScore: 60,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /not baseless|not sturdy|case has a pulse|signals exist|disguise|whole narrative|delayed reply|courtroom drama/i,
  },
  {
    name: 'Social Media Context Variant',
    category: 'romance',
    inputText:
      'They post stories after my texts but dont open my message for hours, then answer nicely later.',
    minScore: 60,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /not baseless|not sturdy|case has a pulse|signals exist|disguise|whole narrative|delayed reply|courtroom drama/i,
  },
  {
    name: 'Friendship Birthday Invite',
    category: 'friendship',
    inputText:
      'My friend texted me happy birthday with a cake emoji and said we should celebrate together this weekend. Does she actually want to hang out?',
    minScore: 20,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /remembered your birthday|weekend plan|real invite|secret code|celebrate this weekend|crumb/i,
    expectedScenarioId: 'friendship_birthday_invite',
  },
  {
    name: 'Friendship Birthday Invite Variant',
    category: 'friendship',
    inputText: 'My friend said happy birthday and that we should celebrate this weekend.',
    minScore: 20,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /remembered your birthday|weekend plan|real invite|secret code|celebrate this weekend|crumb/i,
    expectedScenarioId: 'friendship_birthday_invite',
  },
  {
    name: 'Situationship Late Night No Response',
    category: 'romance',
    inputText:
      'my situationship said ‘i miss u’ at 2am but hasnt responded to my ‘i miss u too’ from 9 hours ago',
    minScore: 65,
    maxScore: 75,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /2am|i miss u|emotional confetti|missing reply|late-night feelings|daytime silence|commitment issues/i,
    expectedScenarioId: 'situationship_late_night_no_response',
  },
  {
    name: 'Situationship Late Night Variant',
    category: 'romance',
    inputText:
      'we are in the talking stage and they texted me at 3am saying i miss you, then no response all day',
    minScore: 65,
    maxScore: 75,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /2am|i miss u|emotional confetti|missing reply|late-night feelings|daytime silence|commitment issues/i,
    expectedScenarioId: 'situationship_late_night_no_response',
  },
  {
    name: 'Deep Scroll No DM',
    category: 'romance',
    inputText:
      'ok so basically we met through mutual friends and he was super into it but then i added him and he followed back but hasnt dmed but watched all my stories and liked a pic from 47 weeks ago so like',
    minScore: 55,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /stale like|digital archaeology|watching stories without DMing|surveillance-adjacent|not a plan/i,
    expectedScenarioId: 'deep_scroll_no_dm',
  },
  {
    name: 'Deep Scroll No Message Variant',
    category: 'general',
    inputText:
      'They watched all my stories and liked an old photo from 12 weeks ago but sent no message.',
    minScore: 55,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /stale like|digital archaeology|watching stories without DMing|surveillance-adjacent|not a plan/i,
    expectedScenarioId: 'deep_scroll_no_dm',
  },
];

const goldenResults: Array<{
  name: string;
  score: number;
  verdict: string;
  read: string;
}> = [];

describe('verdict engine golden cases', () => {
  afterAll(() => {
    console.table(goldenResults);
  });

  it.each(goldenCases)('$name lands on the calibrated score and voice', (goldenCase) => {
    const result = analyzeCase(
      verdictConfig,
      {
        category: goldenCase.category,
        inputText: goldenCase.inputText,
      },
      { includeDebug: Boolean(goldenCase.expectedScenarioId) },
    );

    goldenResults.push({
      name: goldenCase.name,
      score: result.delusionScore,
      verdict: result.verdictLabel,
      read: result.explanationText,
    });

    expect(result.delusionScore).toBeGreaterThanOrEqual(goldenCase.minScore);
    expect(result.delusionScore).toBeLessThanOrEqual(goldenCase.maxScore);
    expect(result.verdictLabel).toBe(goldenCase.verdictLabel);
    expect(result.explanationText).toMatch(goldenCase.explanationPattern);
    expect(result.explanationText).not.toMatch(/Main reasons:/i);
    if (goldenCase.forbiddenExplanationPattern) {
      expect(result.explanationText).not.toMatch(goldenCase.forbiddenExplanationPattern);
    }

    if (goldenCase.expectedScenarioId) {
      expect(result.debug?.scenarioOverrideId).toBe(goldenCase.expectedScenarioId);
    }
  });
});

describe('verdict display labels', () => {
  it('keeps canonical labels stable while varying hero labels deterministically', () => {
    expect(verdictLabels.full_clown_territory).toBe('Full Clown Territory');

    const first = getVerdictDisplayLabel('full_clown_territory', 'case-123|100');
    const second = getVerdictDisplayLabel('full_clown_territory', 'case-123|100');
    const fallback = getVerdictDisplayLabel('full_clown_territory');

    expect(first).toBe(second);
    expect(fallback).toBe('Full Clown Territory');
    expect([
      'Full Clown Territory',
      'Circus Alert',
      'Emergency Clown Mode',
      'Delulu Level: Federal',
      'Case Has Left Reality',
    ]).toContain(first);
  });
});
