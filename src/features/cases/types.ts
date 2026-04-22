import type { CaseRecord, CaseUpdateRecord, GuestCaseLocal, GuestCaseUpdateLocal } from '../../types/shared';

export type CaseEntity = CaseRecord | GuestCaseLocal;
export type CaseUpdateEntity = CaseUpdateRecord | GuestCaseUpdateLocal;

export function isGuestCase(record: CaseEntity): record is GuestCaseLocal {
  return 'localId' in record;
}

export function getCaseId(record: CaseEntity): string {
  return isGuestCase(record) ? record.localId : record.id;
}

export function getCaseUpdates(record: CaseEntity): CaseUpdateEntity[] {
  return isGuestCase(record) ? record.updates : [];
}
