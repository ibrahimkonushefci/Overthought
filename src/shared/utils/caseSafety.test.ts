import { createHash } from 'crypto';
import { analyzeCase, verdictConfig } from '../../features/verdict-engine';
import { assessCaseSafety, CaseSafetyRoutingError } from './caseSafety';
import { dangerousCaseSafetyFixtures, falsePositiveCaseSafetyFixtures } from './caseSafety.fixtures';

describe('case safety routing', () => {
  it.each(dangerousCaseSafetyFixtures)('routes dangerous input before Basic analysis: $name', (fixture) => {
    expect(assessCaseSafety(fixture.inputText)).toMatchObject({ shouldRoute: true });
    expect(() => analyzeCase(verdictConfig, fixture)).toThrow(CaseSafetyRoutingError);
  });

  // Regression: reported bypasses from 2026-07 manual testing — casual/slang
  // first-person harm intent must route despite trivial-sounding reasons.
  it.each([
    'I wanna kill him so badly becasue he is such an idiot',
    'I wanna kill myself tonight because I am kinda bored',
    'I wanna kill him tonight tbh',
  ])('routes reported first-person harm phrasing: %s', (inputText) => {
    expect(assessCaseSafety(inputText).shouldRoute).toBe(true);
  });

  it.each(falsePositiveCaseSafetyFixtures)(
    'preserves byte-identical Basic output for false positive: $name',
    (fixture) => {
      expect(assessCaseSafety(fixture.inputText)).toEqual({ shouldRoute: false, reason: null });
      const result = analyzeCase(verdictConfig, fixture);
      const hash = createHash('sha256').update(JSON.stringify(result)).digest('hex');

      expect(hash).toBe(fixture.expectedAnalysisHash);
    },
  );
});
