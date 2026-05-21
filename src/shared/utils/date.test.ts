import { normalizeIsoTimestamp, parseAppTimestamp, relativeTime } from './date';

describe('date utilities', () => {
  it('treats timezone-less Supabase timestamps as UTC', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T11:56:00.000Z'));

    expect(normalizeIsoTimestamp('2026-05-21T11:56:00')).toBe('2026-05-21T11:56:00.000Z');
    expect(parseAppTimestamp('2026-05-21 11:56:00')).toBe(Date.parse('2026-05-21T11:56:00.000Z'));

    jest.useRealTimers();
  });

  it('treats timezone-less local timestamps as local time when that is closer to now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T18:08:00.000Z'));

    expect(relativeTime('2026-05-21T20:08:00')).toBe('just now');
    expect(relativeTime('2026-05-21T18:08:00')).toBe('just now');

    jest.useRealTimers();
  });

  it('does not show future timestamps as negative relative time', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T11:56:00.000Z'));

    expect(relativeTime('2026-05-21T11:57:00.000Z')).toBe('just now');

    jest.useRealTimers();
  });
});
