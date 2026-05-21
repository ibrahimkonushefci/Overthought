export function nowIso(): string {
  return new Date().toISOString();
}

export function parseAppTimestamp(value: string): number {
  const trimmed = value.trim();

  if (!trimmed) {
    return Number.NaN;
  }

  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = trimmed.replace(' ', 'T');

  if (hasTimezone) {
    return new Date(normalized).getTime();
  }

  const utcTimestamp = new Date(`${normalized}Z`).getTime();
  const localTimestamp = new Date(normalized).getTime();

  if (!Number.isFinite(utcTimestamp)) {
    return localTimestamp;
  }

  if (!Number.isFinite(localTimestamp)) {
    return utcTimestamp;
  }

  const now = Date.now();
  return Math.abs(now - utcTimestamp) <= Math.abs(now - localTimestamp) ? utcTimestamp : localTimestamp;
}

export function normalizeIsoTimestamp(value: string): string {
  const timestamp = parseAppTimestamp(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
}

export function relativeTime(value: string): string {
  const timestamp = parseAppTimestamp(value);

  if (!Number.isFinite(timestamp)) {
    return 'just now';
  }

  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < 0) {
    return 'just now';
  }

  if (diffMs < minute) {
    return 'just now';
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m ago`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago`;
  }

  return `${Math.floor(diffMs / day)}d ago`;
}
