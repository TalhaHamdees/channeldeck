import { daysBetween } from "./date";

/**
 * A rotating provocation for the morning. Not affirmations — the opposite.
 * The discomfort is the mechanism.
 */
const PROMPTS = [
  "If yesterday were your whole life in miniature, what would the headstone read?",
  "What did you call “work” yesterday that was really just hiding?",
  "Who needed something from you yesterday that you quietly ignored?",
  "What would the honest version of your day sound like, read aloud at a funeral?",
  "Name the hour you'll never get back. Was it worth what you traded for it?",
  "What did you avoid yesterday because it was hard, not because it was wrong?",
  "If a stranger watched your last 24 hours on tape, what would they conclude you value?",
  "What promise to yourself did you break before noon?",
  "What did you scroll past your own life to look at?",
  "Yesterday you were one day closer to the end. What did you spend it on?",
  "What small, true thing did you do that no one will ever clap for?",
  "Where did you perform a version of yourself instead of being one?",
  "What were you proud of yesterday — honestly, not for an audience?",
  "What would you do differently if you knew this was the second-to-last chapter?",
  "What truth about your day are you hoping this prompt won't make you write?",
];

const EPITAPH_SEEDS = [
  "scrolled for two hours and called it research",
  "answered every email and none of the questions that mattered",
  "was busy, but could not say with what",
  "kept the hard conversation for a better day that never came",
  "chose the comfortable lie over the useful truth",
  "showed up — quietly, fully, without applause",
  "did the work before they felt like it",
  "loved the people in front of them, not the ones on the screen",
  "waited to be ready",
  "spent the morning bravely and the evening hiding",
];

/** Deterministic per-day pick, so the prompt is stable through the day. */
export function promptForDay(dateKey: string): string {
  const idx = Math.abs(daysBetween("2020-01-01", dateKey)) % PROMPTS.length;
  return PROMPTS[idx];
}

export function epitaphPlaceholder(dateKey: string): string {
  const idx = Math.abs(daysBetween("2020-01-01", dateKey)) % EPITAPH_SEEDS.length;
  return EPITAPH_SEEDS[idx];
}
