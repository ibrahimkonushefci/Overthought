export const EXAMPLE_PROMPTS = [
  "She liked my story but replied after 9 hours.",
  "He said we should hang out sometime but did not set a date.",
  "My friend suddenly started texting more this week.",
  "They watched my story but did not react.",
  "He liked my newest post after leaving me on read all week.",
  "She said maybe sometime next week and then never followed up.",
  "My coworker checks in every morning and uses smiley faces.",
  "They asked for my number but only sent memes after.",
  "My friend said happy birthday but forgot to make plans.",
  "He texts good morning every day but avoids meeting up.",
  "She booked dinner but replied dry today.",
  "They viewed every story but never sent a message.",
  "My best friend left me on read for two days.",
  "He said he is not ready for a relationship but calls at 2am.",
  "She remembered my coffee order but takes hours to reply.",
  "They stood near me at the gym twice but we have never talked.",
  "My boss buys me coffee during our 1-on-1s.",
  "He invited the whole office, but I think it was for me.",
  "She said she wants something casual but acts jealous.",
  "They followed back quickly but have not DM'd.",
  "My friend always replies nicely but never asks anything back.",
  "He sent a fire emoji after ghosting me for a month.",
  "She said she had fun and picked Saturday for dinner.",
  "They post stories after my texts but do not open my message.",
  "My roommate was quiet this morning. Are they mad?",
  "He liked an old photo from 47 weeks ago.",
  "She invited me to a party but said no pressure.",
  "They asked if I am free Friday and then went quiet.",
  "My friend keeps canceling but says we are good.",
  "He introduced me as his friend after eight months.",
  "She apologized for the delay and asked to hang this weekend.",
  "They laughed at my joke in a meeting.",
  "My ex watched my story twice after no contact.",
  "He paid for dinner but talked about crypto the whole time.",
  "She said we should celebrate my birthday this weekend.",
  "They keep ending up near me but never speak.",
  "My friend stopped initiating but still replies fast.",
  "He asked me out officially, and I am still overthinking.",
  "She sent a heart emoji but has not made plans.",
  "They said work is crazy every time I suggest drinks.",
  "My coworker asked about my project and smiled.",
  "He called me late at night and then ignored my reply.",
  "She watched all my stories but skipped my text.",
  "They said I should drop by if I want.",
  "My best friend said sorry and explained work was overwhelming.",
  "He says he misses me but never plans anything.",
  "She asked personal questions but never follows up.",
  "They liked my BeReal after leaving me on delivered.",
  "My friend is nice in person but dry over text.",
  "He bought lunch to talk about my promotion.",
  "She said let's get dinner Friday and booked a table.",
  "They added me to close friends but never text.",
  "My group chat went quiet when I walked in.",
  "He remembered my dog's birthday but not our plans.",
  "She sent a TikTok but ignored my actual question.",
  "They said long time no see after disappearing.",
  "My friend always lets me choose the plan.",
  "He asked if we can hang this weekend.",
  "She replied lol to a serious message.",
  "They invited a few people over and said I can come.",
] as const;

export function pickExamplePrompts(
  count = 4,
  random: () => number = Math.random,
): string[] {
  const pool = [...EXAMPLE_PROMPTS];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    const swapIndex = Math.min(index, Math.max(0, randomIndex));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, Math.min(count, pool.length));
}
