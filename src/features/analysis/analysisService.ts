import type { AnalysisOutput, AnalyzeCaseInput, VerdictLabel } from '../../types/shared';
import { analyzeCase as runVerdictEngine, verdictConfig } from '../verdict-engine';

export interface AnalysisService {
  analyzeCase: (input: AnalyzeCaseInput) => Promise<AnalysisOutput>;
}

function normalizeVerdictLabel(value: string): VerdictLabel {
  return value as VerdictLabel;
}

export const analysisService: AnalysisService = {
  async analyzeCase(input) {
    const result = runVerdictEngine(verdictConfig, input);

    return {
      verdictLabel: normalizeVerdictLabel(result.verdictLabel),
      delusionScore: result.delusionScore,
      explanationText: result.explanationText,
      nextMoveText: result.nextMoveText,
      verdictVersion: result.verdictVersion,
      triggeredSignals: result.triggeredSignals,
    };
  },
};
