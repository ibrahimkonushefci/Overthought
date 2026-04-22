import type { CaseCategory, VerdictLabel } from '../../types/shared';

export interface ShareCardPayload {
  title: string;
  category: CaseCategory;
  verdictLabel: VerdictLabel;
  delusionScore: number;
  explanationText: string;
  nextMoveText: string;
  appName: 'Overthought';
}
