import type {
  CaseCategory,
  CaseRecord,
  CaseUpdateRecord,
  OutcomeStatus,
  VerdictSource,
  VerdictLabel,
} from '../../../types/shared';
import { normalizeIsoTimestamp } from '../../../shared/utils/date';

export interface CaseRow {
  id: string;
  user_id: string;
  title: string | null;
  category: CaseCategory;
  input_text: string;
  verdict_label: VerdictLabel;
  delusion_score: number;
  explanation_text: string;
  next_move_text: string;
  outcome_status: OutcomeStatus;
  latest_verdict_version: number;
  last_analyzed_at: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

export interface CaseUpdateRow {
  id: string;
  case_id: string;
  update_text: string;
  verdict_label: VerdictLabel | null;
  delusion_score: number | null;
  explanation_text: string | null;
  next_move_text: string | null;
  verdict_version: number | null;
  created_at: string;
}

export interface CanonicalCaseRow extends Omit<CaseRow, 'latest_verdict_version'> {
  creation_request_id: string | null;
  result_source: VerdictSource;
  verdict_version: number;
  display_label: string | null;
  evidence_check_text: string | null;
  overreading_text: string | null;
  what_matters_text: string | null;
  smart_verdict_id: string | null;
  smart_created_at: string | null;
}

export function mapCaseRow(row: CaseRow): CaseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    inputText: row.input_text,
    verdictLabel: row.verdict_label,
    delusionScore: row.delusion_score,
    explanationText: row.explanation_text,
    nextMoveText: row.next_move_text,
    verdictVersion: row.latest_verdict_version,
    triggeredSignals: undefined,
    outcomeStatus: row.outcome_status,
    lastAnalyzedAt: normalizeIsoTimestamp(row.last_analyzed_at),
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at),
    archivedAt: row.archived_at ? normalizeIsoTimestamp(row.archived_at) : null,
    deletedAt: row.deleted_at ? normalizeIsoTimestamp(row.deleted_at) : null,
    resultSource: 'legacy_basic',
  };
}

export function mapCanonicalCaseRow(row: CanonicalCaseRow): CaseRecord {
  const smartVerdict =
    row.result_source === 'smart' &&
    row.display_label &&
    row.evidence_check_text &&
    row.overreading_text &&
    row.what_matters_text
      ? {
          verdictLabel: row.verdict_label,
          delusionScore: row.delusion_score,
          displayLabel: row.display_label,
          explanationText: row.explanation_text,
          evidenceCheckText: row.evidence_check_text,
          overreadingText: row.overreading_text,
          whatMattersText: row.what_matters_text,
          nextMoveText: row.next_move_text,
          verdictVersion: row.verdict_version,
          source: 'ai' as const,
        }
      : undefined;

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    inputText: row.input_text,
    verdictLabel: row.verdict_label,
    delusionScore: row.delusion_score,
    explanationText: row.explanation_text,
    nextMoveText: row.next_move_text,
    verdictVersion: row.verdict_version,
    triggeredSignals: undefined,
    outcomeStatus: row.outcome_status,
    lastAnalyzedAt: normalizeIsoTimestamp(row.last_analyzed_at),
    createdAt: normalizeIsoTimestamp(row.created_at),
    updatedAt: normalizeIsoTimestamp(row.updated_at),
    archivedAt: row.archived_at ? normalizeIsoTimestamp(row.archived_at) : null,
    deletedAt: row.deleted_at ? normalizeIsoTimestamp(row.deleted_at) : null,
    resultSource: row.result_source,
    smartVerdict,
  };
}

export function mapCaseUpdateRow(row: CaseUpdateRow): CaseUpdateRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    updateText: row.update_text,
    verdictLabel: row.verdict_label,
    delusionScore: row.delusion_score,
    explanationText: row.explanation_text,
    nextMoveText: row.next_move_text,
    verdictVersion: row.verdict_version,
    createdAt: normalizeIsoTimestamp(row.created_at),
  };
}
