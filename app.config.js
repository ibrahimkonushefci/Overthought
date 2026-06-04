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

const baseExpo = {
  name: 'Overthought',
  slug: 'overthought',
  scheme: 'overthought',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/brand/app-icon.png',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.ibrahim.overthought',
    icon: './assets/brand/app-icon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-dev-client',
      {
        launchMode: 'most-recent',
      },
    ],
  ],
  android: {
    package: 'com.ibrahim.overthought',
  },
  extra: {
    router: {},
    eas: {
      projectId: 'de992f0f-c45d-43ca-8655-b8428d4a9e5f',
    },
  },
};

module.exports = ({ config }) => {
  const expo = {
    ...config,
    ...baseExpo,
    ios: {
      ...config.ios,
      ...baseExpo.ios,
    },
    android: {
      ...config.android,
      ...baseExpo.android,
    },
    extra: {
      ...config.extra,
      ...baseExpo.extra,
    },
  };
  const plugins = (expo.plugins || []).filter((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return pluginName !== '@react-native-google-signin/google-signin';
  });

  return {
    expo: {
      ...expo,
      ios: {
        ...expo.ios,
        bundleIdentifier: isProduction ? 'com.ibrahim.overthought' : 'com.ibrahim.overthought.dev',
        usesAppleSignIn: true,
      },
      extra: {
        ...expo.extra,
        appVariant,
      },
      plugins: [
        ...plugins,
        'expo-apple-authentication',
        'expo-web-browser',
        'expo-sharing',
        'expo-font',
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
