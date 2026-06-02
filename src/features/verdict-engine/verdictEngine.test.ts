import { analyzeCase, verdictConfig } from './index';
import { normalizeText } from './normalize';
import type { Category, SemanticFactId } from './types';
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
  expectedFactIds?: SemanticFactId[];
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
    minScore: 38,
    maxScore: 55,
    verdictLabel: 'mild_delusion',
    explanationPattern: /workplace ambiguity|promise|timeline|formal follow-through|promotion/i,
    forbiddenExplanationPattern: /courtship|flirting|corporate card|iced latte/i,
    expectedScenarioId: 'workplace_mixed_performance_signal',
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
    explanationPattern: /posting stories|dodging your message|unopened text|battery for stories|clarity for your message/i,
    expectedScenarioId: 'posting_stories_message_avoidance',
  },
  {
    name: 'Social Media Context Variant',
    category: 'romance',
    inputText:
      'They post stories after my texts but dont open my message for hours, then answer nicely later.',
    minScore: 60,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /posting stories|dodging your message|unopened text|battery for stories|clarity for your message/i,
    expectedScenarioId: 'posting_stories_message_avoidance',
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
  {
    name: 'Dangling Friday Check',
    category: 'romance',
    inputText: 'They asked if I am free Friday and then went quiet.',
    minScore: 72,
    maxScore: 78,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /door crack|not a plan|going quiet|are you free friday|follow-through disappears|not logistics/i,
    expectedScenarioId: 'dangling_friday_check',
  },
  {
    name: 'Heart Emoji No Plans',
    category: 'romance',
    inputText: 'She sent a heart emoji but has not made plans.',
    minScore: 74,
    maxScore: 80,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /heart emoji|decoration|not effort|without plans|sticker|mostly air/i,
    expectedScenarioId: 'heart_emoji_no_plans',
  },
  {
    name: 'Ex Story View After No Contact',
    category: 'romance',
    inputText: 'My ex watched my story twice after no contact.',
    minScore: 90,
    maxScore: 94,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /ex watching your story|not a comeback|curiosity with wi-fi|not closure|thumb with history/i,
    expectedScenarioId: 'ex_story_view_no_contact',
  },
  {
    name: 'Daytime Slow Evening Faster',
    category: 'romance',
    inputText: 'She takes 8 hours to reply during the day but replies a bit faster during the evening.',
    minScore: 46,
    maxScore: 52,
    verdictLabel: 'mild_delusion',
    explanationPattern: /eight-hour daytime replies|schedule|availability changing after work|hidden message/i,
    expectedScenarioId: 'daytime_slow_evening_faster',
  },
  {
    name: 'Low Information Gibberish',
    category: 'romance',
    inputText: 'Gibberish message jhsadjhkdsaijh Busch hsdjhs',
    minScore: 20,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /not a judgeable case yet|keyboard fog|rewrite it/i,
  },
  {
    name: 'First Date Crying Context',
    category: 'romance',
    inputText: 'She cried on the first date.',
    minScore: 62,
    maxScore: 68,
    verdictLabel: 'mild_delusion',
    explanationPattern: /crying on a first date|not a complete verdict|first-date cry|does not automatically/i,
    expectedScenarioId: 'first_date_crying_context',
  },
  {
    name: 'Stopped Texting After Days',
    category: 'romance',
    inputText: 'He stopped texting me after 12 days.',
    minScore: 88,
    maxScore: 92,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /stopped texting|evidence is not hidden|twelve days|ending in silence|pattern break/i,
    expectedScenarioId: 'stopped_texting_after_days',
  },
  {
    name: 'Dangling Friday Typo Tolerance',
    category: 'romance',
    inputText: 'They asked it im free Friday and then went quiet',
    minScore: 72,
    maxScore: 78,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /door crack|not a plan|going quiet|are you free friday|follow-through disappears|not logistics/i,
    expectedScenarioId: 'dangling_friday_check',
  },
  {
    name: 'Whole Office Invite Overread',
    category: 'social',
    inputText: 'He invited the whole office, but I think it was for me.',
    minScore: 88,
    maxScore: 92,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /whole office|mass invite|secretly for you|group invite|private signal/i,
    expectedScenarioId: 'office_mass_invite_overread',
  },
  {
    name: 'Booked Dinner Dry Reply',
    category: 'romance',
    inputText: 'She booked dinner but replied dry today.',
    minScore: 24,
    maxScore: 30,
    verdictLabel: 'slight_reach',
    explanationPattern: /booked dinner|dry reply|logistics|tone|plan still matters|reservation/i,
    expectedScenarioId: 'booked_dinner_dry_reply',
  },
  {
    name: 'Misses Me But Never Plans',
    category: 'romance',
    inputText: 'He says he misses me but never plans anything.',
    minScore: 88,
    maxScore: 92,
    verdictLabel: 'full_clown_territory',
    explanationPattern: /misses me|never planning|never making plans|behavior|words|progress/i,
    expectedScenarioId: 'misses_me_no_plans',
  },
  {
    name: 'Fire Emoji After Ghosting',
    category: 'romance',
    inputText: 'He sent a fire emoji after ghosting me for a month.',
    minScore: 80,
    maxScore: 88,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /fire emoji|ghosting|romantic revival|door is still unlocked/i,
    expectedScenarioId: 'zombie_breadcrumb_after_ghosting',
  },
  {
    name: 'Follow Back No DM',
    category: 'romance',
    inputText: "They followed back quickly but have not DM'd.",
    minScore: 66,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /follow-back|not DMing|no message|actual DM|words/i,
    expectedScenarioId: 'follow_back_no_dm',
  },
  {
    name: 'Friend Always Lets Me Choose Plan',
    category: 'friendship',
    inputText: 'My friend always lets me choose the plan.',
    minScore: 64,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /always letting you choose|one-sided planning|friendship verdict|pick the next plan|initiate effort/i,
    expectedScenarioId: 'friendship_one_sided_planning',
  },
  {
    name: 'Repeated Work Excuse For Drinks',
    category: 'romance',
    inputText: 'He said work is crazy every time I suggest drinks',
    minScore: 80,
    maxScore: 84,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /work being crazy|every time|suggest drinks|same wall|real time|calendar/i,
    expectedScenarioId: 'repeated_work_excuse_for_plans',
  },
  {
    name: 'Friend Nice In Person Dry Text',
    category: 'friendship',
    inputText: 'My friend is nice in person but dry over text.',
    minScore: 52,
    maxScore: 58,
    verdictLabel: 'mild_delusion',
    explanationPattern: /nice in person|dry over text|face-to-face|phone|friendship verdict|text moisture/i,
    expectedScenarioId: 'friendship_nice_in_person_dry_text',
  },
  {
    name: 'Meeting Joke Politeness',
    category: 'romance',
    inputText: 'They laughed at my joke in a meeting.',
    minScore: 48,
    maxScore: 55,
    verdictLabel: 'mild_delusion',
    explanationPattern: /laughing at a joke|meeting|normal social|joke landed|outside the meeting/i,
    expectedScenarioId: 'meeting_joke_politeness',
  },
  {
    name: 'Disappeared Long Time No See',
    category: 'romance',
    inputText: 'They said long time no see after disappearing.',
    minScore: 82,
    maxScore: 85,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /long time no see|disappearing|low-effort re-entry|casual nostalgia|accountability/i,
    expectedScenarioId: 'disappeared_low_effort_reentry',
  },
  {
    name: 'Dinner Interest No Followthrough',
    category: 'romance',
    inputText:
      'She said I am down for a dinner date but stopped replying after like 2 days when I asked when she is free',
    minScore: 58,
    maxScore: 66,
    verdictLabel: 'mild_delusion',
    explanationPattern: /dinner interest|real evidence|pick a date|availability|stopping|actual time|one clean follow-up/i,
    expectedScenarioId: 'dinner_interest_no_followthrough',
  },
  {
    name: 'Story Like Delayed Reply',
    category: 'romance',
    inputText: 'She liked my story but replied after 9 hours.',
    minScore: 68,
    maxScore: 74,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /story like|late reply|nine-hour reply|crumbs|follow-through|timing/i,
    forbiddenExplanationPattern: /match|reengagement|blank slate/i,
    expectedScenarioId: 'story_like_delayed_reply',
  },
  {
    name: 'Best Friend Apology Context',
    category: 'friendship',
    inputText: 'My best friend said sorry and explained work was overwhelming',
    minScore: 28,
    maxScore: 36,
    verdictLabel: 'slight_reach',
    explanationPattern: /apology|real context|secret attack|work being overwhelming|believable|effort improves|hidden hostility/i,
    expectedScenarioId: 'friendship_apology_with_context',
  },
  {
    name: 'Blocked Closure',
    category: 'romance',
    inputText: 'She blocked me after 10 days of talking without any reason',
    minScore: 24,
    maxScore: 36,
    verdictLabel: 'slight_reach',
    explanationPattern: /blocking|blocked|concrete action|clear boundary|why|closure|leave it alone/i,
    forbiddenExplanationPattern: /blank slate|conclusion without enough action|dramatic verdict/i,
    expectedScenarioId: 'clear_negative_action_closure',
  },
  {
    name: 'Apology Weekend Plan Positive Control',
    category: 'friendship',
    inputText: 'She apologized for the delay and asked to hang this weekend.',
    minScore: 22,
    maxScore: 25,
    verdictLabel: 'slight_reach',
    explanationPattern: /apologized|delay|offered a plan|repair|not abandonment|asked to hang out this weekend/i,
    expectedScenarioId: 'friendship_apology_followup',
  },
  {
    name: 'Manager Dinner Power Context',
    category: 'romance',
    inputText: 'My manager invited me for dinner',
    minScore: 48,
    maxScore: 55,
    verdictLabel: 'mild_delusion',
    explanationPattern: /manager|dinner|concrete action|power-context|normal romance|sensitive/i,
    expectedScenarioId: 'work_power_invitation',
    expectedFactIds: ['hasWorkPowerContext', 'hasInvitation', 'hasDinnerContext'],
  },
  {
    name: 'Late Night Friend Invite',
    category: 'friendship',
    inputText: 'My friend asked me to hang out at 11pm?',
    minScore: 48,
    maxScore: 58,
    verdictLabel: 'mild_delusion',
    explanationPattern: /11pm|late-night|hangout|invite|confession|friendship|ambiguous|normal-time/i,
    expectedScenarioId: 'late_night_friend_invite',
    expectedFactIds: ['hasFriendContext', 'hasInvitation', 'hasLateNightTiming'],
  },
  {
    name: 'Restaurant Stranger Eye Contact',
    category: 'romance',
    inputText: 'A guy made eye contact with me like 50% of the time while I was in the restaurant',
    minScore: 64,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /eye contact|public setting|vibes|approach|conversation|repeated effort/i,
    expectedScenarioId: 'stranger_eye_contact',
    expectedFactIds: ['hasEyeContact', 'hasStrangerSignal'],
  },
  {
    name: 'Late Night Reentry After Silence',
    category: 'romance',
    inputText: 'He left me on read for a full week and then replied at 1am',
    minScore: 78,
    maxScore: 84,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /week|silence|1am|re-entry|consistency|low-effort|daytime effort/i,
    expectedScenarioId: 'late_night_reentry_after_silence',
    expectedFactIds: ['hasGhosting', 'hasDelayedReply', 'hasLateNightReply'],
  },
  {
    name: 'Mixed Consistency Text And In Person',
    category: 'romance',
    inputText:
      "My situationship is very inconsistent, one day he texts me, the next day he doesn't. He is nice in person tho but very bad at texting",
    minScore: 71,
    maxScore: 76,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /mixed-signal|nice in person|inconsistent texting|bad texting|pattern|stable|uneven/i,
    expectedScenarioId: 'mixed_consistency_text_inperson',
    expectedFactIds: ['hasMixedConsistency', 'hasInPersonPositive', 'hasTextingNegative'],
  },
  {
    name: 'Delivered Story View',
    category: 'romance',
    inputText: 'He left my text on Delivered for 12 hours, but he just viewed my Instagram story',
    minScore: 65,
    maxScore: 78,
    verdictLabel: 'dangerous_overthinking',
    explanationPattern: /active enough|online|direct reply|actual response|social activity/i,
    forbiddenExplanationPattern: /strongest signal is a weak signal|match|reengagement/i,
    expectedScenarioId: 'active_on_social_but_not_replying',
    expectedFactIds: ['hasDeliveredNoReply', 'hasActiveOnSocial', 'hasSocialMediaSignal'],
  },
  {
    name: 'Canceled Plan Conflicting Post',
    category: 'friendship',
    inputText:
      'My friend canceled our dinner plans because she was tired, but then posted a picture at a bar with someone else',
    minScore: 56,
    maxScore: 70,
    verdictLabel: 'mild_delusion',
    explanationPattern: /canceling|excuse|social|shaky|canceled plan|post|mismatch/i,
    forbiddenExplanationPattern: /strongest signal is a weak signal/i,
    expectedScenarioId: 'canceled_plan_then_conflicting_post',
    expectedFactIds: ['hasCanceledPlan', 'hasExcuse', 'hasContradictorySocialPost'],
  },
  {
    name: 'Repeated Odd Neighbor Gesture',
    category: 'general',
    inputText:
      'My neighbor keeps returning my stray cat but leaves a single unpeeled orange on my porch every time he does it',
    minScore: 45,
    maxScore: 62,
    verdictLabel: 'mild_delusion',
    explanationPattern: /repeated behavior|odd object|weird|unusual|direct explanation|lore/i,
    forbiddenExplanationPattern: /strongest signal is a weak signal/i,
    expectedScenarioId: 'repeated_odd_gesture',
    expectedFactIds: ['hasRepeatedBehavior', 'hasOddGiftOrObject', 'hasNeighborContext'],
  },
  {
    name: 'Workplace Mixed Performance Signal',
    category: 'general',
    inputText:
      "My boss gave me a highly critical performance review in front of the entire team. But then he pulled me aside afterward, apologized for being harsh, and told me in secret that I'm actually the only person he trusts to take over his role next year. I don't know if I'm being quietly fired or groomed for a promotion.",
    minScore: 38,
    maxScore: 55,
    verdictLabel: 'mild_delusion',
    explanationPattern: /mixed work signals|workplace ambiguity|paperwork|concrete follow-through|clear next step/i,
    forbiddenExplanationPattern: /flirt|courtship|coffee|corporate card|iced latte/i,
    expectedScenarioId: 'workplace_mixed_performance_signal',
    expectedFactIds: [
      'hasFormalWorkAmbiguity',
      'hasWorkCriticism',
      'hasPrivateReassurance',
      'hasPromotionSignal',
    ],
  },
  {
    name: 'Friendship Conflict Deflection Silence',
    category: 'friendship',
    inputText:
      "My best friend of five years completely ignored me at my own birthday dinner to talk to her new work friends. When I gently brought it up the next day, she started crying, said I was being unsupportive of her trying to network, and made me apologize to her. She hasn't texted me since.",
    minScore: 34,
    maxScore: 52,
    verdictLabel: 'mild_delusion',
    explanationPattern: /not inventing|ignored|important moment|flipped|silence|friendship issue|deflection/i,
    forbiddenExplanationPattern: /strongest signal is a weak signal/i,
    expectedScenarioId: 'friendship_conflict_deflection_silence',
    expectedFactIds: [
      'hasIgnoredImportantEvent',
      'hasDeflection',
      'hasUserForcedToApologize',
      'hasNoFollowThrough',
    ],
  },
  {
    name: 'Late Night Friend Invite Hangout Alias',
    category: 'friendship',
    inputText: 'My friend just asked me to hangout at 11pm?',
    minScore: 48,
    maxScore: 58,
    verdictLabel: 'mild_delusion',
    explanationPattern: /11pm|late-night|plans|friendship|ambiguous|normal-time/i,
    forbiddenExplanationPattern: /strongest signal is a weak signal/i,
    expectedScenarioId: 'late_night_friend_invite',
    expectedFactIds: ['hasFriendContext', 'hasInvitation', 'hasLateNightTiming'],
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
      {
        includeDebug: Boolean(
          goldenCase.expectedScenarioId || goldenCase.expectedFactIds?.length,
        ),
      },
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

    goldenCase.expectedFactIds?.forEach((factId) => {
      expect(result.debug?.semanticFacts.ids).toContain(factId);
    });
  });
});

describe('verdict engine low-information guard', () => {
  it.each([
    'asdkj asdklj qweqwe zxc zxc qweqwe asdkj asdklj',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂',
    'blue chair window pizza banana airplane lamp',
    'coffee turtle mirror airport candle broccoli moon carpet wallet',
    'hfhfhfhfhfhfhfhfhfhfhfhfhfhfhfhf',
    'What is the capital of France?',
    'Write me a poem about a dog',
    'Buy Bitcoin now or wait?',
    'Should I buy Ethereum now or wait',
    'Solana looks good here to buy ngl',
    'Explain photosynthesis',
  ])('returns needs-more-context copy instead of a confident verdict for: %s', (inputText) => {
    const result = analyzeCase(verdictConfig, { category: 'romance', inputText }, { includeDebug: true });

    expect(result.delusionScore).toBeLessThanOrEqual(30);
    expect(result.verdictLabel).toBe('slight_reach');
    expect(result.confidenceLevel).toBe('low');
    expect(result.triggeredSignals).toContain('needs_more_context_input');
    expect(result.explanationText).toMatch(/not a judgeable case|not homework|not a case file/i);
  });

  it.each([
    'She looked at me and I think something happened',
    'He is weird and I don’t know',
    'My friend acted different today and I am confused',
    'Someone texted me and now I’m overthinking',
    'Are you serious right now bro?',
    'Ai më shkruan çdo mëngjes por thotë që nuk do lidhje serioze.',
    'Ella me mira en clase y se ríe, pero nunca me escribe primero.',
  ])('asks for more context when Basic Verdict cannot safely read: %s', (inputText) => {
    const result = analyzeCase(verdictConfig, { category: 'romance', inputText }, { includeDebug: true });

    expect(result.delusionScore).toBeLessThanOrEqual(30);
    expect(result.verdictLabel).toBe('slight_reach');
    expect(result.confidenceLevel).toBe('low');
    expect(result.triggeredSignals).toContain('needs_more_context_input');
    expect(result.nextMoveText).toMatch(/who did what|what happened|Basic Verdict|want judged/i);
  });

  it('uses safer low-confidence copy for mixed-language input Basic Verdict may only partially understand', () => {
    const result = analyzeCase(
      verdictConfig,
      {
        category: 'romance',
        inputText: 'He më la on read for two days but pastaj liked my story.',
      },
      { includeDebug: true },
    );

    expect(result.delusionScore).toBeLessThanOrEqual(30);
    expect(result.verdictLabel).toBe('slight_reach');
    expect(result.confidenceLevel).toBe('low');
    expect(result.triggeredSignals).toContain('needs_more_context_input');
    expect(result.triggeredSignals).toContain('unsupported_local_language');
    expect(result.explanationText).toMatch(/Basic Verdict can't read this clearly enough/i);
    expect(result.explanationText).toMatch(/Smart Verdict may understand this better/i);
    expect(result.nextMoveText).toBe('Add who did what, what happened, and what you want judged.');
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

describe('category scoring calibration', () => {
  it('applies category overrides for friendliness reads', () => {
    const inputText =
      'They smiled at me a lot, helped me with homework, and answered politely when I asked for advice.';

    const romance = analyzeCase(verdictConfig, { category: 'romance', inputText }, { includeDebug: true });
    const friendship = analyzeCase(verdictConfig, { category: 'friendship', inputText }, { includeDebug: true });

    expect(
      romance.debug?.matchedSignals.find((signal) => signal.id === 'friendliness_misread_as_interest')?.weightApplied,
    ).toBe(16);
    expect(
      friendship.debug?.matchedSignals.find((signal) => signal.id === 'friendliness_misread_as_interest')?.weightApplied,
    ).toBe(10);
    expect(friendship.delusionScore).toBeLessThan(romance.delusionScore);
  });

  it('keeps direct action strongest in romance compared with social reads', () => {
    const inputText = 'They asked if I wanted to hang out this weekend and made plans for Saturday.';

    const romance = analyzeCase(verdictConfig, { category: 'romance', inputText }, { includeDebug: true });
    const social = analyzeCase(verdictConfig, { category: 'social', inputText }, { includeDebug: true });

    expect(romance.debug?.matchedSignals.find((signal) => signal.id === 'direct_action')?.weightApplied).toBe(-32);
    expect(social.debug?.matchedSignals.find((signal) => signal.id === 'direct_action')?.weightApplied).toBe(-16);
    expect(romance.delusionScore).toBeLessThan(social.delusionScore);
  });

  it('keeps social-media signals category-sensitive without changing the canonical verdict contract', () => {
    const inputText = 'They liked my story, watched all my stories, and sent a heart emoji, but there is no message yet.';

    const romance = analyzeCase(verdictConfig, { category: 'romance', inputText }, { includeDebug: true });
    const friendship = analyzeCase(verdictConfig, { category: 'friendship', inputText }, { includeDebug: true });
    const social = analyzeCase(verdictConfig, { category: 'social', inputText }, { includeDebug: true });

    expect(
      romance.debug?.matchedSignals.find((signal) => signal.id === 'social_media_overread')?.weightApplied,
    ).toBe(18);
    expect(
      friendship.debug?.matchedSignals.find((signal) => signal.id === 'social_media_overread')?.weightApplied,
    ).toBe(14);
    expect(
      social.debug?.matchedSignals.find((signal) => signal.id === 'social_media_overread')?.weightApplied,
    ).toBe(20);
    [romance, friendship, social].forEach((result) => {
      expect(result.delusionScore).toEqual(expect.any(Number));
      expect(result.explanationText).toEqual(expect.any(String));
      expect(result.nextMoveText).toEqual(expect.any(String));
      expect(result.verdictVersion).toBe(1);
    });
  });
});

describe('verdict engine fallback generalization', () => {
  it('does not turn unmatched high-risk signals into full-clown generic copy', () => {
    const result = analyzeCase(
      verdictConfig,
      {
        category: 'romance',
        inputText: 'They stood near me, smiled once, and maybe looked at me in a meeting.',
      },
      { includeDebug: true },
    );

    expect(result.debug?.scenarioOverrideId).toBeUndefined();
    expect(result.delusionScore).toBeLessThanOrEqual(70);
    expect(result.verdictLabel).not.toBe('full_clown_territory');
    expect(result.explanationText).not.toMatch(
      /fake mustache|wedding cake|theory is louder|confidence is doing push-ups/i,
    );
    expect(result.explanationText).toMatch(
      /strongest signal|worth noticing|provisional|concrete behavior|doing most of the work/i,
    );
  });

  it('keeps clear negative-action closure copy action-neutral when the input is not a block', () => {
    const result = analyzeCase(
      verdictConfig,
      {
        category: 'romance',
        inputText: 'She unfollowed me after 10 days of talking without any reason',
      },
      { includeDebug: true },
    );

    expect(result.debug?.scenarioOverrideId).toBe('clear_negative_action_closure');
    expect(result.explanationText).toMatch(/concrete negative action|boundary|reason/i);
    expect(result.nextMoveText).toMatch(/boundary|closure|closure signal/i);
    expect(`${result.explanationText} ${result.nextMoveText}`).not.toMatch(/\bblock(?:ed|ing)?\b/i);
  });
});

describe('verdict engine normalization equivalence', () => {
  it('treats I am, I’m, Im, and i’m dinner-interest variants as the same case', () => {
    const inputVariants = [
      'She said I am down for a dinner date but stopped replying after like 2 days when I asked when she is free',
      "She said I'm down for a dinner date but stopped replying after like 2 days when I asked when she is free",
      'She said Im down for a dinner date but stopped replying after like 2 days when I asked when she is free',
      'She said i’m down for a dinner date but stopped replying after like 2 days when I asked when she is free',
    ];
    const normalizedVariants = inputVariants.map(normalizeText);

    expect(new Set(normalizedVariants).size).toBe(1);

    const results = inputVariants.map((inputText) =>
      analyzeCase(
        verdictConfig,
        {
          category: 'romance',
          inputText,
        },
        { includeDebug: true },
      ),
    );
    const firstResult = results[0];

    results.forEach((result) => {
      expect(result.debug?.scenarioOverrideId).toBe('dinner_interest_no_followthrough');
      expect(result.delusionScore).toBe(firstResult.delusionScore);
      expect(result.verdictLabel).toBe(firstResult.verdictLabel);
      expect(result.explanationText).toBe(firstResult.explanationText);
      expect(result.nextMoveText).toBe(firstResult.nextMoveText);
    });
  });

  it('keeps dinner no-follow-through wording variants in the same semantic family', () => {
    const inputVariants = [
      'She said im down for a dinner date but stopped replying after 2 days when I asked if she is free',
      'She said im down for a dinner date but stopped replying like after 2 days when I asked when she is free',
      'She said Im down for a dinner date but stopped replying after like 2 days when I asked when she is free',
    ];

    const results = inputVariants.map((inputText) =>
      analyzeCase(
        verdictConfig,
        {
          category: 'romance',
          inputText,
        },
        { includeDebug: true },
      ),
    );

    results.forEach((result) => {
      expect(result.debug?.scenarioOverrideId).toBe('dinner_interest_no_followthrough');
      expect(result.debug?.semanticFacts.ids).toEqual(
        expect.arrayContaining([
          'hasInvitation',
          'hasDinnerContext',
          'hasNoFollowThrough',
          'hasQuestionForAvailability',
        ]),
      );
      expect(result.delusionScore).toBeGreaterThanOrEqual(58);
      expect(result.delusionScore).toBeLessThanOrEqual(66);
      expect(result.explanationText).toMatch(/dinner interest|real evidence|pick a date|weakens/i);
      expect(result.nextMoveText).toMatch(/one clean follow-up|actual time|leave it there/i);
    });
  });
});

describe('semantic facts evaluation set', () => {
  const evaluationCases: Array<{
    category: Category;
    inputText: string;
    expectedPattern: RegExp;
    expectedScenarioId?: string;
  }> = [
    {
      category: 'romance',
      inputText: 'She keeps liking my stories but never replies to my actual messages.',
      expectedPattern: /online|direct reply|social activity|actual response/i,
      expectedScenarioId: 'active_on_social_but_not_replying',
    },
    {
      category: 'romance',
      inputText: "He replied 'haha' after two days but keeps watching every story.",
      expectedPattern: /online|direct reply|social activity|actual response/i,
      expectedScenarioId: 'active_on_social_but_not_replying',
    },
    {
      category: 'romance',
      inputText: 'She said we should hang out sometime but ignored me when I asked what day.',
      expectedPattern: /invite|day|silence|timing|follow-through/i,
      expectedScenarioId: 'soft_invite_no_followthrough',
    },
    {
      category: 'romance',
      inputText: 'He texts me only after midnight but never makes real plans.',
      expectedPattern: /late-night|after-midnight|real plans|low-effort|daytime effort/i,
      expectedScenarioId: 'late_night_texting_no_plans',
    },
    {
      category: 'friendship',
      inputText: 'My friend said she was too tired to meet but then went out with other people.',
      expectedPattern: /excuse|social|shaky|canceled plan|mismatch|suspicious/i,
      expectedScenarioId: 'canceled_plan_then_conflicting_post',
    },
    {
      category: 'social',
      inputText: 'A girl at the gym keeps looking at me but never says anything.',
      expectedPattern: /eye contact|public setting|vibes|approach|conversation/i,
      expectedScenarioId: 'stranger_eye_contact',
    },
    {
      category: 'general',
      inputText: 'My boss praised me privately but criticized me in the meeting.',
      expectedPattern: /workplace ambiguity|private reassurance|clear timeline|formal follow-through/i,
      expectedScenarioId: 'workplace_mixed_performance_signal',
    },
    {
      category: 'general',
      inputText: 'My manager invited me for coffee after giving me extra work.',
      expectedPattern: /workplace ambiguity|promise|clear timeline|formal follow-through/i,
      expectedScenarioId: 'workplace_mixed_performance_signal',
    },
    {
      category: 'general',
      inputText: 'My boss said I have potential but gave me no raise or promotion.',
      expectedPattern: /workplace ambiguity|promise|clear timeline|formal follow-through/i,
      expectedScenarioId: 'workplace_mixed_performance_signal',
    },
    {
      category: 'general',
      inputText: 'A person keeps returning my cat with weird little gifts.',
      expectedPattern: /repeated behavior|odd object|unusual|direct explanation|lore/i,
      expectedScenarioId: 'repeated_odd_gesture',
    },
  ];

  it.each(evaluationCases)('routes broader semantic prompt: $inputText', (evaluationCase) => {
    const result = analyzeCase(
      verdictConfig,
      {
        category: evaluationCase.category,
        inputText: evaluationCase.inputText,
      },
      { includeDebug: true },
    );

    expect(result.debug?.scenarioOverrideId).toBe(evaluationCase.expectedScenarioId);
    expect(result.explanationText).toMatch(evaluationCase.expectedPattern);
    expect(result.explanationText).not.toMatch(/strongest signal is a weak signal/i);
    expect(result.delusionScore).toBeLessThanOrEqual(85);
  });
});
