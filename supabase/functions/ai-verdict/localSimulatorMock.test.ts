import { canUseLocalSimulatorMock, generateLocalSimulatorVerdict } from './localSimulatorMock';

describe('local simulator Smart provider', () => {
  it('can only be enabled for a loopback Supabase URL', () => {
    expect(canUseLocalSimulatorMock('http://127.0.0.1:54321', 'true')).toBe(true);
    expect(canUseLocalSimulatorMock('http://localhost:54321', 'true')).toBe(true);
    expect(canUseLocalSimulatorMock('http://kong:8000', 'true')).toBe(true);
    expect(canUseLocalSimulatorMock('https://example.supabase.co', 'true')).toBe(false);
    expect(canUseLocalSimulatorMock('http://127.0.0.1:54321', undefined)).toBe(false);
    expect(canUseLocalSimulatorMock('not-a-url', 'true')).toBe(false);
  });

  it('returns a Smart-shaped result derived from the internal calibration', async () => {
    const result = await generateLocalSimulatorVerdict({
      targetType: 'guest_case',
      snapshot: {
        guestCaseId: 'guest-case-local-simulator',
        category: 'friendship',
        inputText: 'My friend said they wanted to meet but never selected a day or time.',
        localVerdictLabel: 'mild_delusion',
        localDelusionScore: 50,
        localExplanationText: 'Local explanation.',
        localNextMoveText: 'Local next move.',
        localVerdictVersion: 1,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      verdict: {
        verdictLabel: 'mild_delusion',
        delusionScore: 50,
        displayLabel: 'Simulator Reality Check',
      },
      modelVersion: 'local-simulator-v1',
    });
  });

  it('uses the authenticated case calibration fields', async () => {
    const result = await generateLocalSimulatorVerdict({
      targetType: 'case',
      row: {
        id: 'case-local-simulator',
        user_id: 'user-local-simulator',
        category: 'general',
        input_text: 'A clear local simulator case with enough context to judge safely.',
        verdict_label: 'slight_reach',
        delusion_score: 28,
        explanation_text: 'Local explanation.',
        next_move_text: 'Local next move.',
        latest_verdict_version: 1,
        archived_at: null,
        deleted_at: null,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      verdict: {
        verdictLabel: 'slight_reach',
        delusionScore: 28,
      },
    });
  });
});
