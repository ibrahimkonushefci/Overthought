import { parseAppTimestamp } from '../../shared/utils/date';
import type { CaseEntity } from './types';
import { isGuestCase } from './types';

export interface CaseActivity {
  timestamp: string;
  kind: 'created' | 'updated';
}

function newestTimestamp(values: Array<string | null | undefined>, fallback: string): string {
  return values.reduce<string>((latest, candidate) => {
    if (!candidate) return latest;
    return parseAppTimestamp(candidate) > parseAppTimestamp(latest) ? candidate : latest;
  }, fallback);
}

export function getCaseActivity(record: CaseEntity): CaseActivity {
  const guestUpdateTimes = isGuestCase(record) ? record.updates.map((update) => update.createdAt) : [];
  const timestamp = newestTimestamp(
    [
      record.latestActivityAt,
      record.latestUpdateAt,
      record.updatedAt,
      record.lastAnalyzedAt,
      ...guestUpdateTimes,
    ],
    record.createdAt,
  );
  const created = parseAppTimestamp(record.createdAt);
  const activity = parseAppTimestamp(timestamp);

  return {
    timestamp,
    kind: Number.isFinite(created) && Number.isFinite(activity) && activity > created ? 'updated' : 'created',
  };
}

export function compareCasesByActivity(left: CaseEntity, right: CaseEntity): number {
  return parseAppTimestamp(getCaseActivity(right).timestamp) - parseAppTimestamp(getCaseActivity(left).timestamp);
}
