import { analyzeCase } from './analyzeCase';
import { verdictConfig } from './config';

const firstPass = analyzeCase(
  verdictConfig,
  {
    inputText:
      'He liked my story, replied after 9 hours, and said we should hang out sometime.',
    category: 'romance',
  },
  { includeDebug: true },
);

console.log('First pass:', firstPass);

const updatedPass = analyzeCase(
  verdictConfig,
  {
    inputText:
      'He liked my story, replied after 9 hours, and said we should hang out sometime.',
    category: 'romance',
    updateText: 'Now he actually made plans and picked a date for Friday.',
    previousCaseContext: {
      originalInputText:
        'He liked my story, replied after 9 hours, and said we should hang out sometime.',
      priorScore: firstPass.delusionScore,
      priorVerdictLabel: firstPass.verdictLabel,
      priorTriggeredSignals: firstPass.triggeredSignals,
      priorUpdateCount: 0,
    },
  },
  { includeDebug: true },
);

console.log('Updated pass:', updatedPass);
