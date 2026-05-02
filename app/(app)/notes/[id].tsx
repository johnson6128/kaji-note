import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNote, useSoftDeleteNote, useCreateExecution, useShareLink } from '@/hooks/useNotes';
import { useExecutionStore } from '@/stores/executionStore';
import { StepItem } from '@/components/StepItem';
import { CATEGORY_MAP } from '@/utils/frequency';

const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? '';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [executionMode, setExecutionMode] = useState(false);

  const { data: note, isLoading } = useNote(id ?? null);
  const softDelete = useSoftDeleteNote();
  const createExecution = useCreateExecution();
  const { query: shareLinkQuery, create: createShareLink } = useShareLink(id ?? null);

  const {
    currentStepIndex,
    completedStepIds,
    startExecution,
    markStepComplete,
    nextStep,
    prevStep,
    exitExecution,
  } = useExecutionStore();

  if (isLoading || !note) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#E8734A" size="large" />
      </SafeAreaView>
    );
  }

  const cat = CATEGORY_MAP[note.category] ?? { label: 'その他', emoji: '📝' };

  async function handleDelete() {
    Alert.alert('削除の確認', `「${note!.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await softDelete.mutateAsync({ noteId: note!.id, groupId: note!.group_id });
            router.back();
          } catch (e: any) {
            Alert.alert('エラー', e.message);
          }
        },
      },
    ]);
  }

  async function handleShare() {
    try {
      let token = shareLinkQuery.data?.token;
      if (!token) {
        const result = await createShareLink.mutateAsync();
        token = result.token;
      }
      const url = `${SHARE_BASE_URL}/share/${token}`;
      await Share.share({ message: `${note!.title}\n${url}`, url });
    } catch (e: any) {
      Alert.alert('エラー', e.message);
    }
  }

  function handleStartExecution() {
    startExecution(note!.id);
    setExecutionMode(true);
  }

  async function handleFinishExecution() {
    if (note!.status === 'published') {
      try {
        await createExecution.mutateAsync({ noteId: note!.id });
        Alert.alert('完了！', '実施記録を保存しました。');
      } catch (e: any) {
        Alert.alert('エラー', e.message);
      }
    }
    exitExecution();
    setExecutionMode(false);
  }

  // --- 実行モード ---
  if (executionMode && note.steps.length > 0) {
    const currentStep = note.steps[currentStepIndex];
    const isLast = currentStepIndex === note.steps.length - 1;
    const isCompleted = completedStepIds.includes(currentStep.id);

    return (
      <SafeAreaView className="flex-1 bg-cream">
        {/* ヘッダー */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-ruled-line">
          <TouchableOpacity onPress={() => { exitExecution(); setExecutionMode(false); }}>
            <Ionicons name="close" size={24} color="#2C2C2C" />
          </TouchableOpacity>
          <Text className="text-ink font-semibold">
            {currentStepIndex + 1} / {note.steps.length}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* プログレスバー */}
        <View className="h-1 bg-cream-dark">
          <View
            className="h-1 bg-accent"
            style={{ width: `${((currentStepIndex + 1) / note.steps.length) * 100}%` }}
          />
        </View>

        <ScrollView className="flex-1 px-4 py-6">
          <Text className="text-ink font-bold text-xl mb-6">{note.title}</Text>
          <StepItem
            step={currentStep}
            stepNumber={currentStepIndex + 1}
            isExecutionMode
            isCompleted={isCompleted}
            onComplete={() => markStepComplete(currentStep.id)}
          />
        </ScrollView>

        {/* 下部ナビゲーション */}
        <View className="px-4 pb-6 pt-2 border-t border-ruled-line gap-3">
          <View className="flex-row gap-3">
            {currentStepIndex > 0 && (
              <TouchableOpacity
                onPress={prevStep}
                className="flex-1 border border-ruled-line rounded-lg py-3 items-center"
              >
                <Text className="text-ink font-medium">← 前へ</Text>
              </TouchableOpacity>
            )}
            {!isLast ? (
              <TouchableOpacity
                onPress={nextStep}
                className="flex-1 bg-accent rounded-lg py-3 items-center"
              >
                <Text className="text-white font-semibold">次へ →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleFinishExecution}
                disabled={note.status !== 'published'}
                className={`flex-1 rounded-lg py-3 items-center ${
                  note.status === 'published' ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <Text className="text-white font-semibold">
                  {note.status === 'published' ? '✓ 完了・実施済みにする' : '完了（下書き）'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- 閲覧モード ---
  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* ヘッダー */}
      <View className="flex-row items-center px-4 py-3 border-b border-ruled-line">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#2C2C2C" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-ink font-bold text-lg" numberOfLines={1}>
            {note.title}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/(app)/notes/${id}/edit` as any)}
          className="ml-2 p-2"
        >
          <Ionicons name="pencil-outline" size={20} color="#2C2C2C" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* メタ情報 */}
        <View className="flex-row items-center mb-4 gap-2">
          <Text style={{ fontSize: 24 }}>{cat.emoji}</Text>
          <Text className="text-ink-light text-sm">{cat.label}</Text>
          <View className={`ml-2 px-2 py-0.5 rounded-full ${note.status === 'published' ? 'bg-green-100' : 'bg-yellow-100'}`}>
            <Text className={`text-xs font-medium ${note.status === 'published' ? 'text-green-700' : 'text-yellow-700'}`}>
              {note.status === 'published' ? '公開中' : '下書き'}
            </Text>
          </View>
        </View>

        {/* ステップ一覧 */}
        {note.steps.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-ink-light text-sm">ステップがまだありません</Text>
          </View>
        ) : (
          note.steps.map((step, index) => (
            <StepItem key={step.id} step={step} stepNumber={index + 1} />
          ))
        )}
      </ScrollView>

      {/* アクションボタン */}
      <View className="px-4 pb-6 pt-2 border-t border-ruled-line gap-2">
        <TouchableOpacity
          onPress={handleStartExecution}
          disabled={note.steps.length === 0}
          className={`rounded-lg py-4 items-center ${note.steps.length === 0 ? 'bg-gray-200' : 'bg-accent'}`}
        >
          <Text className={`font-semibold text-base ${note.steps.length === 0 ? 'text-ink-light' : 'text-white'}`}>
            ▶ 実行モードで開始
          </Text>
        </TouchableOpacity>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handleShare}
            disabled={note.status !== 'published'}
            className={`flex-1 border rounded-lg py-3 items-center ${note.status === 'published' ? 'border-ruled-line' : 'border-gray-200'}`}
          >
            <Text className={`text-sm font-medium ${note.status === 'published' ? 'text-ink' : 'text-gray-300'}`}>
              🔗 共有
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            className="flex-1 border border-red-200 rounded-lg py-3 items-center"
          >
            <Text className="text-red-500 text-sm font-medium">🗑 削除</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
