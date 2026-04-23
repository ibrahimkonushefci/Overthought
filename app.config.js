const base = require('./app.json');

const googleIosUrlScheme =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
  'com.googleusercontent.apps.overthought-placeholder';

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
        // TODO: Re-enable Apple Sign In after Apple Developer enrollment and signing are available.
        usesAppleSignIn: false,
      },
      plugins: [
        ...plugins,
        'expo-web-browser',
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
