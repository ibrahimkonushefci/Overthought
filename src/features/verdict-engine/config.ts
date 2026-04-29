import rawConfig from './config/verdict-config.v1.json';
import type {
  ScenarioOverride,
  SignalDefinition,
  SignalNeutralizer,
  VerdictBand,
  VerdictEngineConfig,
} from './types';

function assertVerdictBand(value: unknown): asserts value is VerdictBand {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid verdict band: expected object.');
  }

  const band = value as VerdictBand;
  if (
    typeof band.min !== 'number' ||
    typeof band.max !== 'number' ||
    typeof band.label !== 'string'
  ) {
    throw new Error('Invalid verdict band shape.');
  }
}

function assertSignalDefinition(value: unknown): asserts value is SignalDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid signal definition: expected object.');
  }

  const signal = value as SignalDefinition;
  if (
    typeof signal.id !== 'string' ||
    typeof signal.type !== 'string' ||
    typeof signal.defaultWeight !== 'number' ||
    !Array.isArray(signal.patterns)
  ) {
    throw new Error(`Invalid signal definition shape for signal: ${String(signal?.id)}`);
  }
}

function assertSignalNeutralizer(value: unknown): asserts value is SignalNeutralizer {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid signal neutralizer: expected object.');
  }

  const neutralizer = value as SignalNeutralizer;
  if (
    typeof neutralizer.id !== 'string' ||
    !Array.isArray(neutralizer.requiredSignalIds) ||
    (typeof neutralizer.excludedSignalIds !== 'undefined' &&
      !Array.isArray(neutralizer.excludedSignalIds)) ||
    !Array.isArray(neutralizer.affectedSignalIds)
  ) {
    throw new Error(`Invalid signal neutralizer shape for: ${String(neutralizer?.id)}`);
  }
}

function assertScenarioOverride(value: unknown): asserts value is ScenarioOverride {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid scenario override: expected object.');
  }

  const scenario = value as ScenarioOverride;
  if (
    typeof scenario.id !== 'string' ||
    !Array.isArray(scenario.requiredSignalIds) ||
    !Array.isArray(scenario.explanationTemplates) ||
    !Array.isArray(scenario.nextMoveTemplates)
  ) {
    throw new Error(`Invalid scenario override shape for: ${String(scenario?.id)}`);
  }
}

export function assertValidVerdictConfig(value: unknown): asserts value is VerdictEngineConfig {
  if (!value || typeof value !== 'object') {
    throw new Error('Verdict config must be an object.');
  }

  const config = value as VerdictEngineConfig;

  if (typeof config.version !== 'number') {
    throw new Error('Verdict config missing numeric version.');
  }

  if (typeof config.baseScore !== 'number') {
    throw new Error('Verdict config missing numeric baseScore.');
  }

  if (
    !config.scoreClamp ||
    typeof config.scoreClamp.min !== 'number' ||
    typeof config.scoreClamp.max !== 'number'
  ) {
    throw new Error('Verdict config missing scoreClamp.');
  }

  if (
    !config.caps ||
    typeof config.caps.maxPositiveEvidenceReduction !== 'number' ||
    typeof config.caps.maxWeakEvidenceIncrease !== 'number' ||
    typeof config.caps.maxContextModifierAdjustment !== 'number' ||
    typeof config.caps.maxApplicationsPerSignal !== 'number'
  ) {
    throw new Error('Verdict config missing caps.');
  }

  if (!Array.isArray(config.verdictBands) || config.verdictBands.length === 0) {
    throw new Error('Verdict config must include verdictBands.');
  }

  config.verdictBands.forEach(assertVerdictBand);

  if (!Array.isArray(config.signals) || config.signals.length === 0) {
    throw new Error('Verdict config must include signals.');
  }

  config.signals.forEach(assertSignalDefinition);

  if (!Array.isArray(config.signalNeutralizers)) {
    throw new Error('Verdict config missing signalNeutralizers.');
  }

  config.signalNeutralizers.forEach(assertSignalNeutralizer);

  if (!Array.isArray(config.scenarioOverrides)) {
    throw new Error('Verdict config missing scenarioOverrides.');
  }

  config.scenarioOverrides.forEach(assertScenarioOverride);

  if (!config.nextMoveTemplates || typeof config.nextMoveTemplates !== 'object') {
    throw new Error('Verdict config missing nextMoveTemplates.');
  }

  if (!config.dominantSignalOverrides || typeof config.dominantSignalOverrides !== 'object') {
    throw new Error('Verdict config missing dominantSignalOverrides.');
  }

  if (
    !config.explanationTemplates ||
    typeof config.explanationTemplates.high === 'undefined' ||
    typeof config.explanationTemplates.mid === 'undefined' ||
    typeof config.explanationTemplates.low === 'undefined'
  ) {
    throw new Error('Verdict config missing explanationTemplates.');
  }
}

assertValidVerdictConfig(rawConfig);

export const verdictConfig: VerdictEngineConfig = rawConfig as VerdictEngineConfig;
