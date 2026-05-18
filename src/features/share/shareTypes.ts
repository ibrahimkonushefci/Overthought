import type { CaseCategory, VerdictLabel } from '../../types/shared';

export interface ShareCardPayload {
  mode: 'result' | 'deep_read';
  variant?: 'basic' | 'ai';
  title: string;
  caseDisplayId: string;
  category: CaseCategory;
  verdictLabel: VerdictLabel;
  delusionScore: number;
  explanationText: string;
  nextMoveText: string;
  deepReadRoastLine?: string;
  deepReadTakeaway?: string;
  appName: 'Overthought';
}
