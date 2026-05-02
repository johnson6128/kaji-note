import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'signup';

function validateEmail(val: string): string {
  if (!val) return 'メールアドレスを入力してください';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return '有効なメールアドレスを入力してください';
  return '';
}

function validatePassword(val: string): string {
  if (!val) return 'パスワードを入力してください';
  if (val.length < 8) return '8文字以上で入力してください';
  if (!/[a-zA-Z]/.test(val) || !/[0-9]/.test(val)) return '英字と数字をそれぞれ1文字以上含めてください';
  return '';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  async function handleSubmit() {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert('ログインエラー', error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          Alert.alert('登録エラー', error.message);
        } else {
          Alert.alert(
            '確認メールを送信しました',
            'メールボックスを確認してアカウントを有効化してください。',
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'kajinote://auth/callback' },
      });
      if (error) Alert.alert('Googleログインエラー', error.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setEmailError('');
    setPasswordError('');
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-8 pt-16 pb-8">
            {/* ロゴ */}
            <View className="items-center mb-2">
              <Text className="text-ink font-bold" style={{ fontSize: 38, letterSpacing: 1 }}>
                kaji-note
              </Text>
              <Text className="text-ink-light text-sm mt-1">Household Chore Notes</Text>
            </View>

            {/* 罫線 */}
            <View className="border-b border-ruled-line my-6" />

            {/* メールアドレス */}
            <View className="mb-4">
              <Text className="text-ink-light text-sm mb-1">メールアドレス</Text>
              <TextInput
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                placeholder="example@email.com"
                placeholderTextColor="#A09080"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="bg-white border border-ruled-line rounded-lg px-4 py-3 text-ink text-base"
              />
              {emailError ? <Text className="text-red-500 text-xs mt-1">{emailError}</Text> : null}
            </View>

            {/* パスワード */}
            <View className="mb-6">
              <Text className="text-ink-light text-sm mb-1">パスワード</Text>
              <TextInput
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                placeholder="8文字以上（英数字を含む）"
                placeholderTextColor="#A09080"
                secureTextEntry
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="bg-white border border-ruled-line rounded-lg px-4 py-3 text-ink text-base"
              />
              {passwordError ? <Text className="text-red-500 text-xs mt-1">{passwordError}</Text> : null}
            </View>

            {/* ログイン/登録ボタン */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
              className={`bg-accent rounded-lg py-4 items-center mb-4 ${loading ? 'opacity-60' : ''}`}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  {mode === 'login' ? 'ログイン' : 'アカウントを作成'}
                </Text>
              )}
            </TouchableOpacity>

            {/* 区切り線 */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 border-b border-ruled-line" />
              <Text className="text-ink-light text-sm mx-3">または</Text>
              <View className="flex-1 border-b border-ruled-line" />
            </View>

            {/* Google ログイン */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={loading}
              activeOpacity={0.8}
              className="border border-ruled-line bg-white rounded-lg py-4 items-center mb-8"
            >
              <Text className="text-ink font-medium text-base">🔵 Googleでログイン</Text>
            </TouchableOpacity>

            {/* モード切り替え */}
            <TouchableOpacity onPress={toggleMode} className="items-center">
              <Text className="text-accent text-sm underline">
                {mode === 'login' ? 'アカウントを作成する' : 'ログインに戻る'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
