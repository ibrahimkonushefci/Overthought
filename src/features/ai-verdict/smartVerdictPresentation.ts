import type { AiVerdictAccessState } from '../../types/shared';
import type { AiVerdictQuotaLoadState } from '../../store/aiVerdictQuotaStore';

export type SmartLimitVariant = 'guest' | 'free' | 'premium' | 'service';
export type SmartLimitProtectedContent = 'draft' | 'legacy';

export interface SmartLimitPresentation {
  title: string;
  rows: [string, string, string];
  primaryLabel: string;
  secondaryLabel: string | null;
}

function dateKey(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function formatSmartReset(
  resetAt?: string | null,
  options: { now?: Date; locale?: string; timeZone?: string } = {},
): string {
  if (!resetAt) return 'Your allowance resets daily.';

  const reset = new Date(resetAt);
  if (!Number.isFinite(reset.getTime())) return 'Your allowance resets daily.';

  const now = options.now ?? new Date();
  const today = dateKey(now, options.timeZone);
  const tomorrow = dateKey(new Date(now.getTime() + 86_400_000), options.timeZone);
  const resetDay = dateKey(reset, options.timeZone);
  const dayLabel =
    resetDay === today
      ? 'today'
      : resetDay === tomorrow
        ? 'tomorrow'
        : new Intl.DateTimeFormat(options.locale, {
            timeZone: options.timeZone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(reset);
  const time = new Intl.DateTimeFormat(options.locale, {
    timeZone: options.timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(reset);

  return `Resets ${dayLabel} at ${time} on this device.`;
}

export function buildSmartLimitPresentation({
  variant,
  access,
  protectedContent = 'draft',
}: {
  variant: SmartLimitVariant;
  access?: AiVerdictAccessState | null;
  protectedContent?: SmartLimitProtectedContent;
}): SmartLimitPresentation {
  const protectedCopy =
    protectedContent === 'legacy'
      ? 'Your Legacy Basic Verdict is unchanged.'
      : 'Your draft is safe. No case was created.';

  if (variant === 'guest') {
    return {
      title: 'Guest Smart Verdicts used',
      rows: [
        `You’ve used your ${access?.limit ?? 2} free guest Smart Verdicts.`,
        protectedCopy,
        'Sign in to get a daily Smart Verdict allowance.',
      ],
      primaryLabel: 'Sign in',
      secondaryLabel: protectedContent === 'legacy' ? 'Keep legacy result' : 'Keep draft',
    };
  }

  if (variant === 'free') {
    return {
      title: 'Today’s free Smart Verdicts are used',
      rows: [
        `You’ve used ${access?.used ?? access?.limit ?? 2} of ${access?.limit ?? 2} free Smart Verdicts today.`,
        protectedCopy,
        `${formatSmartReset(access?.resetAt)} Premium includes up to 50 Smart Verdicts a day.`,
      ],
      primaryLabel: 'Upgrade',
      secondaryLabel: protectedContent === 'legacy' ? 'Keep legacy result' : 'Keep draft',
    };
  }

  if (variant === 'premium') {
    return {
      title: 'Today’s Premium Smart Verdicts are used',
      rows: [
        `You’ve used today’s ${access?.limit ?? 50} Smart Verdict allowance.`,
        protectedCopy,
        formatSmartReset(access?.resetAt),
      ],
      primaryLabel: protectedContent === 'legacy' ? 'Keep legacy result' : 'Keep draft',
      secondaryLabel: null,
    };
  }

  return {
    title: 'Smart Verdicts are temporarily paused',
    rows: [
      'The service limit has been reached for now.',
      protectedCopy,
      'Please try again later.',
    ],
    primaryLabel: protectedContent === 'legacy' ? 'Keep legacy result' : 'Keep draft',
    secondaryLabel: null,
  };
}

export function smartAllowanceText(
  status: AiVerdictQuotaLoadState,
  access: AiVerdictAccessState | null,
): string {
  if (!access || status === 'idle' || status === 'unknown') {
    return 'Smart allowance unavailable · we’ll check when you submit';
  }

  if (access.accessTier === 'guest') {
    return `Guest · ${access.remaining} of ${access.limit} Smart Verdicts left (lifetime)`;
  }

  const tier = access.accessTier === 'premium' ? 'Premium' : 'Free';
  return `${tier} · ${access.remaining} of ${access.limit} left today · ${formatSmartReset(access.resetAt).replace(/\.$/, '').toLowerCase()}`;
}

export function smartResultQuotaLabel(access: AiVerdictAccessState | null, fromAnalysis: boolean): string | undefined {
  if (!fromAnalysis || !access) return undefined;
  return access.accessTier === 'guest' ? `${access.remaining} left` : `${access.remaining} left today`;
}
