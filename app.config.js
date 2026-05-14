const base = require('./app.json');

const enableGoogleAuth = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
const fallbackGoogleIosUrlScheme = 'com.googleusercontent.apps.overthought-placeholder';
const appVariant = process.env.APP_VARIANT === 'production' ? 'production' : 'development';
const isProduction = appVariant === 'production';

process.env.EXPO_PUBLIC_APP_VARIANT = appVariant;

if (enableGoogleAuth) {
  if (!googleIosUrlScheme) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is required when EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=true. Use the reversed iOS client ID, for example com.googleusercontent.apps.<id>.',
    );
  }

  if (!googleIosUrlScheme.startsWith('com.googleusercontent.apps.')) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME must be the reversed iOS client ID and should start with com.googleusercontent.apps.',
    );
  }
}

module.exports = () => {
  const baseExpo = base.expo;
  const plugins = (baseExpo.plugins || []).filter((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return pluginName !== '@react-native-google-signin/google-signin';
  });

  return {
    expo: {
      ...baseExpo,
      ios: {
        ...baseExpo.ios,
        bundleIdentifier: isProduction ? 'com.ibrahim.overthought' : 'com.ibrahim.overthought.dev',
        usesAppleSignIn: true,
      },
      extra: {
        ...baseExpo.extra,
        appVariant,
      },
      plugins: [
        ...plugins,
        'expo-apple-authentication',
        'expo-web-browser',
        'expo-sharing',
        [
          '@react-native-google-signin/google-signin',
          {
            iosUrlScheme: googleIosUrlScheme || fallbackGoogleIosUrlScheme,
          },
        ],
      ],
    },
  };
};
