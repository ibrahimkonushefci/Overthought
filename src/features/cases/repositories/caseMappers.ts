import type {
  CaseCategory,
  CaseRecord,
  CaseUpdateRecord,
  OutcomeStatus,
  VerdictLabel,
} from '../../../types/shared';

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
    lastAnalyzedAt: row.last_analyzed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
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
    createdAt: row.created_at,
  };
}
