import type { ConfigContext, ExpoConfig } from 'expo/config';

// Build-time validation: missing vars fail the build early rather than at runtime.
const requiredEnvVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        'Copy .env.example to .env.local and fill in the values.',
    );
  }
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'kaji-note',
  slug: 'kaji-note',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'kajinote',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.kajinote.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.kajinote.app',
  },
  plugins: [
    'expo-router',
    'expo-image-picker',
    [
      'expo-image-manipulator',
      // No additional native config needed for expo-image-manipulator
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // EXPO_PUBLIC_* vars are already available via process.env at runtime,
    // but duplicating here lets Constants.expoConfig.extra be used if needed.
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
