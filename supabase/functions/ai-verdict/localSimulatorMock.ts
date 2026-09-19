import type { AiVerdictGenerationTarget, AiVerdictProviderResult } from './core.ts';

export function canUseLocalSimulatorMock(supabaseUrl: string, enabledValue: string | undefined): boolean {
  if (enabledValue !== 'true') {
    return false;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === 'kong';
  } catch {
    return false;
  }
}

export function generateLocalSimulatorVerdict(
  target: AiVerdictGenerationTarget,
): Promise<AiVerdictProviderResult> {
  const localScore = target.targetType === 'case' ? target.row.delusion_score : target.snapshot.localDelusionScore;
  const delusionScore = Math.max(0, Math.min(100, localScore));

  return Promise.resolve({
    ok: true,
    verdict: {
      verdictLabel:
        target.targetType === 'case' ? target.row.verdict_label : target.snapshot.localVerdictLabel,
      delusionScore,
      displayLabel: 'Simulator Reality Check',
      explanationText:
        'The local Smart test completed successfully. The situation has a signal, but it still needs real follow-through before it earns a full storyline.',
      evidenceCheckText:
        'The concrete action in the case is the receipt; everything beyond that is still interpretation.',
      overreadingText:
        'Your brain is turning one uncertain moment into a finished script before the other person has learned their lines.',
      whatMattersText:
        'Consistent action after this moment matters more than squeezing another meaning out of it.',
      nextMoveText: 'Ask one clear question, then judge the answer and follow-through.',
      verdictVersion: 1,
    },
    modelVersion: 'local-simulator-v1',
  });
}
