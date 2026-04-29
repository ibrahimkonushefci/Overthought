// Overthought - shared domain types for app/client/backend contracts

export type UUID = string;

export type AuthProvider = 'apple' | 'google' | 'email' | 'unknown';
export type CaseCategory = 'romance' | 'friendship' | 'social' | 'general';
export type OutcomeStatus = 'unknown' | 'right' | 'wrong' | 'unclear';
export type VerdictLabel =
  | 'barely_delusional'
  | 'slight_reach'
  | 'mild_delusion'
  | 'dangerous_overthinking'
  | 'full_clown_territory';
export type EntitlementStatus = 'free' | 'premium' | 'grace_period' | 'expired';
export type EntitlementSource = 'none' | 'revenuecat' | 'manual_debug';
export type DeepReadTargetType = 'case' | 'case_update';
export type DeepReadAccessTier = 'guest' | 'free' | 'premium';
export type DeepReadUsageStatus = 'reserved' | 'succeeded' | 'failed' | 'expired';
export type DeepReadFailureCode =
  | 'not_authenticated'
  | 'case_not_found'
  | 'deep_read_not_configured'
  | 'quota_exceeded'
  | 'fair_use_exceeded'
  | 'ai_timeout'
  | 'ai_failed'
  | 'invalid_ai_response'
  | 'cache_write_failed'
  | 'unknown';

export interface Profile {
  id: UUID;
  email: string | null;
  displayName: string | null;
  authProvider: AuthProvider;
  onboardingCompleted: boolean;
  isGuest: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UserPreferences {
  userId: UUID;
  notificationsEnabled: boolean;
  pushToken: string | null;
  preferredTone: string | null;
  preferredDefaultCategory: CaseCategory | null;
  shareWatermarkEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PremiumState {
  userId: UUID;
  entitlementStatus: EntitlementStatus;
  source: EntitlementSource;
  entitlementId: string | null;
  productId: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export interface PremiumPackage {
  identifier: string;
  offeringIdentifier: string | null;
  packageType: string;
  productIdentifier: string;
  title: string;
  priceString: string;
  periodLabel: string | null;
}

export interface DeepReadOutput {
  whatsActuallyHappening: string;
  whatYoureOverreading: string;
  whatEvidenceActuallyMatters: string;
  whatToDoNext: string;
  roastLine: string;
}

export interface DeepReadCacheMetadata {
  id: UUID | string;
  source: 'cache' | 'generated';
  targetType: DeepReadTargetType;
  targetFingerprint: string;
  modelProvider: string;
  modelName: string;
  modelVersion: string | null;
  promptVersion: number;
  responseSchemaVersion: number;
  createdAt: string;
}

export interface DeepReadAccessState {
  accessTier: DeepReadAccessTier;
  allowed: boolean;
  remaining: number | null;
  limit: number | null;
  quotaBucket: string | null;
  reason?: 'guest_used' | 'daily_limit' | 'fair_use' | 'not_authenticated' | 'not_configured';
}

export interface AnalysisOutput {
  verdictLabel: VerdictLabel;
  delusionScore: number;
  explanationText: string;
  nextMoveText: string;
  verdictVersion: number;
  triggeredSignals?: string[];
}

export interface CaseRecord extends AnalysisOutput {
  id: UUID;
  userId: UUID;
  title: string | null;
  category: CaseCategory;
  inputText: string;
  outcomeStatus: OutcomeStatus;
  lastAnalyzedAt: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export interface CaseUpdateRecord {
  id: UUID;
  caseId: UUID;
  updateText: string;
  verdictLabel: VerdictLabel | null;
  delusionScore: number | null;
  explanationText: string | null;
  nextMoveText: string | null;
  verdictVersion: number | null;
  createdAt: string;
}

// Local guest models
export interface GuestCaseLocal extends Omit<CaseRecord, 'id' | 'userId'> {
  localId: string;
  localOwnerId: string;
  updates: GuestCaseUpdateLocal[];
  syncStatus: 'local_only' | 'pending_migration';
}

export interface GuestCaseUpdateLocal extends Omit<CaseUpdateRecord, 'id' | 'caseId'> {
  localId: string;
  localCaseId: string;
}

// Create / update payloads
export interface CreateCaseInput {
  category: CaseCategory;
  inputText: string;
  title?: string | null;
}

export interface CreateCasePayload extends CreateCaseInput, AnalysisOutput {}

export interface AddCaseUpdateInput {
  caseId: UUID;
  updateText: string;
}

export interface AddCaseUpdatePayload extends AddCaseUpdateInput, AnalysisOutput {}

export interface UpdateOutcomeInput {
  caseId: UUID;
  outcomeStatus: OutcomeStatus;
}

export interface AnalyzeCaseInput {
  category: CaseCategory;
  inputText: string;
  previousCaseContext?: {
    originalInputText: string;
    priorScore: number;
    priorVerdictLabel: VerdictLabel;
    priorTriggeredSignals: string[];
    priorUpdateCount: number;
  };
  updateText?: string;
}

export interface DeepReadCaseSnapshot {
  targetType: 'case';
  caseId: UUID | string;
  category: CaseCategory;
  inputText: string;
  localVerdictLabel: VerdictLabel;
  localDelusionScore: number;
  localVerdictVersion: number;
}

export interface DeepReadCaseUpdateSnapshot {
  targetType: 'case_update';
  caseId: UUID | string;
  caseUpdateId: UUID | string;
  category: CaseCategory;
  inputText: string;
  updateText: string;
  localVerdictLabel: VerdictLabel;
  localDelusionScore: number;
  localVerdictVersion: number;
}

export type DeepReadTargetSnapshot = DeepReadCaseSnapshot | DeepReadCaseUpdateSnapshot;

export interface DeepReadRequest {
  target: DeepReadTargetSnapshot;
  guestLocalId?: string;
}

export type DeepReadResponse =
  | {
      ok: true;
      deepRead: DeepReadOutput;
      cache: DeepReadCacheMetadata;
      access: DeepReadAccessState;
    }
  | {
      ok: false;
      code: DeepReadFailureCode;
      message: string;
      access?: DeepReadAccessState;
    };

export interface GuestMigrationPayload {
  guestLocalId: string;
  cases: Array<{
    localId: string;
    title: string | null;
    category: CaseCategory;
    inputText: string;
    verdictLabel: VerdictLabel;
    delusionScore: number;
    explanationText: string;
    nextMoveText: string;
    verdictVersion: number;
    outcomeStatus: OutcomeStatus;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
    updates: Array<{
      localId: string;
      updateText: string;
      verdictLabel: VerdictLabel | null;
      delusionScore: number | null;
      explanationText: string | null;
      nextMoveText: string | null;
      verdictVersion: number | null;
      createdAt: string;
    }>;
  }>;
}
