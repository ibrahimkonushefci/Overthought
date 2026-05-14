const base = require('./app.json');

const googleIosUrlScheme =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
  'com.googleusercontent.apps.overthought-placeholder';
const appVariant = process.env.APP_VARIANT === 'production' ? 'production' : 'development';
const isProduction = appVariant === 'production';

process.env.EXPO_PUBLIC_APP_VARIANT = appVariant;

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
        // TODO: Re-enable Apple Sign In after Apple Developer enrollment and signing are available.
        usesAppleSignIn: false,
      },
      extra: {
        ...baseExpo.extra,
        appVariant,
      },
      plugins: [
        ...plugins,
        'expo-web-browser',
        'expo-sharing',
        [
          '@react-native-google-signin/google-signin',
          {
            iosUrlScheme: googleIosUrlScheme,
          },
        ],
      ],
    },
  };
};
