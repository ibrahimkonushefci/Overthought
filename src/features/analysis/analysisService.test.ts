import { analysisService } from './analysisService';

describe('analysisService', () => {
  it('returns deterministic verdict output without external services', async () => {
    const result = await analysisService.analyzeCase({
      category: 'romance',
      inputText: 'She liked my story but replied after 9 hours.',
    });

    expect(result.verdictVersion).toBe(1);
    expect(result.delusionScore).toBeGreaterThanOrEqual(0);
    expect(result.delusionScore).toBeLessThanOrEqual(100);
    expect(result.verdictLabel).toEqual(expect.any(String));
    expect(result.explanationText).toEqual(expect.any(String));
    expect(result.nextMoveText).toEqual(expect.any(String));
    expect(result.triggeredSignals?.length).toBeGreaterThan(0);
  });
});
