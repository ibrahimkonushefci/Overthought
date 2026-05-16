import type { VerdictLabel } from '../../types/shared';

export type Category = 'romance' | 'friendship' | 'social' | 'general';

export type SignalType =
  | 'positive_evidence'
  | 'weak_evidence'
  | 'context_modifier';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type SemanticFactId =
  | 'hasInvitation'
  | 'hasSpecificPlan'
  | 'hasTimeOrDate'
  | 'hasNoFollowThrough'
  | 'hasDelayedReply'
  | 'hasGhosting'
  | 'hasLateNightTiming'
  | 'hasLateNightReply'
  | 'hasSocialMediaSignal'
  | 'hasStrangerSignal'
  | 'hasEyeContact'
  | 'hasWorkPowerContext'
  | 'hasFriendContext'
  | 'hasConcreteNegativeAction'
  | 'hasApology'
  | 'hasExplanation'
  | 'hasMixedConsistency'
  | 'hasInPersonPositive'
  | 'hasTextingNegative'
  | 'hasQuestionForAvailability'
  | 'hasUserConclusion'
  | 'hasDinnerContext'
  | 'hasDeliveredNoReply'
  | 'hasActiveOnSocial'
  | 'hasCanceledPlan'
  | 'hasExcuse'
  | 'hasContradictorySocialPost'
  | 'hasRepeatedBehavior'
  | 'hasOddGiftOrObject'
  | 'hasNeighborContext'
  | 'hasWorkCriticism'
  | 'hasPrivateReassurance'
  | 'hasPromotionSignal'
  | 'hasIgnoredImportantEvent'
  | 'hasDeflection'
  | 'hasUserForcedToApologize'
  | 'hasFormalWorkAmbiguity';

export interface SemanticFacts extends Record<SemanticFactId, boolean> {
  ids: SemanticFactId[];
}

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

export interface SignalNeutralizer {
  id: string;
  requiredSignalIds: string[];
  excludedSignalIds?: string[];
  affectedSignalIds: string[];
}

export interface ScenarioOverride {
  id: string;
  category?: Category;
  requiredSignalIds: string[];
  excludedSignalIds?: string[];
  priority?: number;
  scoreFloor?: number;
  scoreCeiling?: number;
  explanationTemplates: string[];
  nextMoveTemplates: string[];
}

export interface VerdictEngineConfig {
  version: number;
  baseScore: number;
  scoreClamp: ScoreClamp;
  caps: EngineCaps;
  verdictBands: VerdictBand[];
  signals: SignalDefinition[];
  signalNeutralizers: SignalNeutralizer[];
  scenarioOverrides: ScenarioOverride[];
  nextMoveTemplates: Record<string, string[]>;
  dominantSignalOverrides: Record<string, string[]>;
  explanationTemplates: Record<'high' | 'mid' | 'low', string[]>;
}

export interface TriggeredSignal {
  id: string;
  type: SignalType;
  weightApplied: number;
  originalWeightApplied?: number;
  neutralizedBy?: string[];
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
  scenarioOverrideId?: string;
  semanticFacts: SemanticFacts;
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
