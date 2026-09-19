import { buildSmartLimitPresentation, formatSmartReset, smartAllowanceText, smartResultQuotaLabel } from './smartVerdictPresentation';

describe('Smart Verdict quota presentation', () => {
  it('never tells guests that their lifetime allowance resets', () => {
    const presentation = buildSmartLimitPresentation({
      variant: 'guest',
      access: {
        accessTier: 'guest',
        allowed: false,
        used: 2,
        remaining: 0,
        limit: 2,
        quotaScope: 'lifetime',
        quotaBucket: null,
      },
    });

    expect(presentation.primaryLabel).toBe('Sign in');
    expect(presentation.rows.join(' ')).not.toMatch(/reset/i);
    expect(presentation.rows).toContain('Your draft is safe. No case was created.');
  });

  it('formats the UTC reset in Europe/Belgrade local time', () => {
    expect(
      formatSmartReset('2026-09-20T00:00:00.000Z', {
        now: new Date('2026-09-19T17:00:00.000Z'),
        locale: 'en-US',
        timeZone: 'Europe/Belgrade',
      }),
    ).toBe('Resets tomorrow at 2:00 AM on this device.');
  });

  it('uses a safe fallback when reset time is missing', () => {
    expect(formatSmartReset(null)).toBe('Your allowance resets daily.');
  });

  it('uses legacy-specific protected copy', () => {
    const presentation = buildSmartLimitPresentation({ variant: 'free', protectedContent: 'legacy' });
    expect(presentation.rows).toContain('Your Legacy Basic Verdict is unchanged.');
  });

  it('shows an unknown allowance without inventing a number', () => {
    expect(smartAllowanceText('unknown', null)).toBe('Smart allowance unavailable · we’ll check when you submit');
  });

  it('shows quota only for a freshly generated result', () => {
    const access = {
      accessTier: 'free' as const,
      allowed: false,
      used: 2,
      remaining: 0,
      limit: 2,
      quotaScope: 'daily' as const,
      quotaBucket: '2026-09-19',
    };
    expect(smartResultQuotaLabel(access, true)).toBe('0 left today');
    expect(smartResultQuotaLabel(access, false)).toBeUndefined();
  });
});
