import type { CaseCategory, VerdictLabel } from '../../types/shared';
import { colors } from '../theme/tokens';

export const categoryLabels: Record<CaseCategory, string> = {
  romance: 'Romance',
  friendship: 'Friendship',
  social: 'Social',
  general: 'General',
};

export const categoryIcons: Record<CaseCategory, string> = {
  romance: '💔',
  friendship: '🤝',
  social: '👀',
  general: '🌀',
};

export const verdictLabels: Record<VerdictLabel, string> = {
  barely_delusional: 'Barely Delusional',
  slight_reach: 'Reaching, Slightly',
  mild_delusion: 'Mild Delusion',
  dangerous_overthinking: 'Dangerous Overthinking',
  full_clown_territory: 'Full Clown Territory',
};

export const verdictDisplayLabelVariants: Record<VerdictLabel, string[]> = {
  barely_delusional: [
    'Barely Delusional',
    "You're Probably Fine",
    'Normal Human Behavior Detected',
    'Low Drama Detected',
    'Put The Corkboard Away',
  ],
  slight_reach: [
    'Reaching, Slightly',
    'Tiny Reach',
    'Light Spiral',
    'One Toe In Delulu',
    'Suspicious, But Barely',
  ],
  mild_delusion: [
    'Mild Delusion',
    'Evidence Is On Probation',
    'The Math Is Wobbly',
    'Maybe, But Relax',
    'The Plot Is Thin',
  ],
  dangerous_overthinking: [
    'Dangerous Overthinking',
    'Put The Phone Down',
    'Certified Spiral',
    'Severe Plot Construction',
    'Overthinking With Intent',
  ],
  full_clown_territory: [
    'Full Clown Territory',
    'Circus Alert',
    'Emergency Clown Mode',
    'Delulu Level: Federal',
    'Case Has Left Reality',
  ],
};

function hashDisplaySeed(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function getVerdictDisplayLabel(verdictLabel: VerdictLabel, seed?: string): string {
  const variants = verdictDisplayLabelVariants[verdictLabel];

  if (!variants?.length || !seed) {
    return verdictLabels[verdictLabel];
  }

  return variants[hashDisplaySeed(seed) % variants.length];
}

export const verdictIcons: Record<VerdictLabel, string> = {
  barely_delusional: '✅',
  slight_reach: '🤔',
  mild_delusion: '🙂',
  dangerous_overthinking: '📖',
  full_clown_territory: '🤡',
};

export function scoreColor(score: number): string {
  if (score <= 25) {
    return colors.verdict.low;
  }

  if (score <= 55) {
    return colors.verdict.mid;
  }

  if (score <= 80) {
    return colors.verdict.high;
  }

  return colors.verdict.clown;
}

export function scoreToneBackground(score: number): string {
  const color = scoreColor(score).replace('#', '');
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, 0.15)`;
}

export function titleFromInput(inputText: string): string {
  const firstLine = inputText.trim().split('\n')[0] ?? '';
  const compressed = firstLine.replace(/\s+/g, ' ').trim();

  if (compressed.length <= 62) {
    return compressed || 'Untitled case';
  }

  return `${compressed.slice(0, 59).trim()}...`;
}
