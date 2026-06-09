const privacyPolicyUrl = 'https://overthought.app/privacy-policy.html';
const termsUrl = 'https://overthought.app/terms-of-use.html';

function loadEnv() {
  jest.resetModules();

  return require('./env') as typeof import('./env');
}

describe('env legal URLs', () => {
  const originalPrivacyPolicyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const originalTermsUrl = process.env.EXPO_PUBLIC_TERMS_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = originalPrivacyPolicyUrl;
    process.env.EXPO_PUBLIC_TERMS_URL = originalTermsUrl;
  });

  it('defaults to functional legal URLs', () => {
    delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
    delete process.env.EXPO_PUBLIC_TERMS_URL;

    const { env } = loadEnv();

    expect(env.privacyPolicyUrl).toBe(privacyPolicyUrl);
    expect(env.termsUrl).toBe(termsUrl);
  });

  it('maps the rejected trailing-slash URLs to the functional .html URLs', () => {
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = privacyPolicyUrl.replace('.html', '/');
    process.env.EXPO_PUBLIC_TERMS_URL = termsUrl.replace('.html', '/');

    const { env } = loadEnv();

    expect(env.privacyPolicyUrl).toBe(privacyPolicyUrl);
    expect(env.termsUrl).toBe(termsUrl);
  });
});
