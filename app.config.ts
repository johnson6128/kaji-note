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
    infoPlist: {
      NSMicrophoneUsageDescription:
        '音声入力でステップの説明文を記録するために使用します。',
      NSSpeechRecognitionUsageDescription:
        '話した内容をテキストに変換してステップに入力するために使用します。',
    },
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
    [
      'expo-image-picker',
      {
        cameraPermission: 'ステップの写真を撮影するために使用します。',
        mediaLibraryPermission:
          'ライブラリの写真を手順書のステップに追加するために使用します。',
      },
    ],
    [
      'expo-image-manipulator',
      // No additional native config needed for expo-image-manipulator
    ],
    [
      'expo-build-properties',
      {
        android: {
          permissions: ['android.permission.RECORD_AUDIO'],
        },
      },
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
