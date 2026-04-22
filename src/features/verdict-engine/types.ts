import type { VerdictLabel } from '../../types/shared';

export type Category = 'romance' | 'friendship' | 'social' | 'general';

export type SignalType =
  | 'positive_evidence'
  | 'weak_evidence'
  | 'context_modifier';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface PreviousCaseContext {
  originalInputText: string;
  priorScore: number;
  priorVerdictLabel: VerdictLabel;
  priorTriggeredSignals: string[];
  priorUpdateCount: number;
}

export interface CaseAnalysisInput {
  inputText: string;
  category: Category;
  previousCaseContext?: PreviousCaseContext;
  updateText?: string;
}

export interface VerdictBand {
  min: number;
  max: number;
  label: VerdictLabel;
}

export interface ScoreClamp {
  min: number;
  max: number;
}

export interface EngineCaps {
  maxPositiveEvidenceReduction: number;
  maxWeakEvidenceIncrease: number;
  maxContextModifierAdjustment: number;
  maxApplicationsPerSignal: number;
}

export interface SignalDefinition {
  id: string;
  type: SignalType;
  defaultWeight: number;
  categoryWeightOverrides?: Partial<Record<Category, number>>;
  patterns: string[];
}

export interface VerdictEngineConfig {
  version: number;
  baseScore: number;
  scoreClamp: ScoreClamp;
  caps: EngineCaps;
  verdictBands: VerdictBand[];
  signals: SignalDefinition[];
  nextMoveTemplates: Record<string, string[]>;
  dominantSignalOverrides: Record<string, string[]>;
  explanationTemplates: Record<'high' | 'mid' | 'low', string[]>;
}

export interface TriggeredSignal {
  id: string;
  type: SignalType;
  weightApplied: number;
  matchedPatterns: string[];
  source: 'input' | 'update' | 'both';
}

export interface AnalysisDebugInfo {
  baseScore: number;
  weakEvidenceDelta: number;
  positiveEvidenceDelta: number;
  contextModifierDelta: number;
  rawScore: number;
  clampedScore: number;
  previousScoreDelta?: number;
  dominantSignalId?: string;
  matchedSignals: TriggeredSignal[];
}

export interface CaseAnalysisResult {
  verdictLabel: VerdictLabel;
  delusionScore: number;
  explanationText: string;
  nextMoveText: string;
  verdictVersion: number;
  triggeredSignals: string[];
  confidenceLevel: ConfidenceLevel;
  debug?: AnalysisDebugInfo;
}
