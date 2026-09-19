import { normalizeIsoTimestamp, parseAppTimestamp, relativeTime } from './date';

describe('date utilities', () => {
  it('treats timezone-less Supabase timestamps as UTC', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T11:56:00.000Z'));

    expect(normalizeIsoTimestamp('2026-05-21T11:56:00')).toBe('2026-05-21T11:56:00.000Z');
    expect(parseAppTimestamp('2026-05-21 11:56:00')).toBe(Date.parse('2026-05-21T11:56:00.000Z'));

    jest.useRealTimers();
  });

  it('uses explicit timezone offsets without applying the device offset twice', () => {
    expect(parseAppTimestamp('2026-09-19T19:00:00+02:00')).toBe(Date.parse('2026-09-19T17:00:00.000Z'));
    expect(parseAppTimestamp('2026-09-19T19:00:00+0200')).toBe(Date.parse('2026-09-19T17:00:00.000Z'));
    expect(parseAppTimestamp('2026-09-19T17:00:00+00')).toBe(Date.parse('2026-09-19T17:00:00.000Z'));
  });

  it('does not show future timestamps as negative relative time', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-21T11:56:00.000Z'));

    expect(relativeTime('2026-05-21T11:57:00.000Z')).toBe('just now');

    jest.useRealTimers();
  });
});
