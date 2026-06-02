import { assessCaseInputQuality } from './caseInputQuality';

describe('case input quality', () => {
  it.each([
    'asdkj asdklj qweqwe zxc zxc qweqwe asdkj asdklj',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂',
    'blue chair window pizza banana airplane lamp',
    'coffee turtle mirror airport candle broccoli moon carpet wallet',
    'hfhfhfhfhfhfhfhfhfhfhfhfhfhfhfhf',
    'same same same same same same same same',
  ])('blocks obvious unusable input: %s', (inputText) => {
    expect(assessCaseInputQuality(inputText).status).toBe('block');
  });

  it.each([
    'What is the capital of France?',
    'Write me a poem about a dog',
    'Buy Bitcoin now or wait?',
    'Should I buy Ethereum now or wait',
    'Solana looks good here to buy ngl',
    'Explain photosynthesis',
  ])('blocks obvious non-case prompts: %s', (inputText) => {
    const result = assessCaseInputQuality(inputText);

    expect(result.status).toBe('block');
    expect(result.reason).toBe('not_a_case');
  });

  it.each([
    'She looked at me and I think something happened',
    'He is weird and I do not know',
    'My friend acted different today and I am confused',
    'Someone texted me and now I am overthinking',
    'Are you serious right now bro?',
  ])('marks vague but possibly real social input as needing context: %s', (inputText) => {
    expect(assessCaseInputQuality(inputText).status).toBe('needs_context');
  });

  it.each([
    'Ai më shkruan çdo mëngjes por thotë që nuk do lidhje serioze.',
    'Ella me mira en clase y se ríe, pero nunca me escribe primero.',
    'He më la on read for two days but pastaj liked my story.',
  ])('does not frontend-block valid non-English or mixed-language social input: %s', (inputText) => {
    expect(assessCaseInputQuality(inputText).status).not.toBe('block');
  });

  it('warns but allows mixed-language social input that Basic Verdict may only partially understand', () => {
    const result = assessCaseInputQuality('He më la on read for two days but pastaj liked my story.');

    expect(result.status).toBe('needs_context');
    expect(result.reason).toBe('unsupported_local_language');
  });

  it.each([
    'She liked my story but replied after 9 hours.',
    'He said he is not ready for a relationship but calls at 2am.',
    'My friend keeps canceling but says we are good.',
    'He said "maybe later" when I asked to hang out, but then he watched all my stories within minutes.',
    'She never texts first, por en persona she is always smiling and asking personal questions.',
  ])('allows ordinary valid social cases: %s', (inputText) => {
    expect(assessCaseInputQuality(inputText).status).toBe('ok');
  });
});
