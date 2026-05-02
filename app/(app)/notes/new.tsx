import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCreateNote, useCreateStep } from '@/hooks/useNotes';
import { useMyGroups } from '@/hooks/useGroups';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { NoteCategory, NoteStatus, FrequencyType } from '@/types/database';

const CATEGORIES: { value: NoteCategory; label: string; emoji: string }[] = [
  { value: 'cleaning', label: '掃除', emoji: '🧹' },
  { value: 'cooking', label: '料理', emoji: '🍳' },
  { value: 'laundry', label: '洗濯', emoji: '👕' },
  { value: 'storage', label: '収納', emoji: '📦' },
  { value: 'other', label: 'その他', emoji: '📝' },
];

const FREQUENCIES: { value: FrequencyType; label: string }[] = [
  { value: 'none', label: '設定しない' },
  { value: 'daily', label: '毎日' },
  { value: 'weekly', label: '週次' },
  { value: 'monthly', label: '月次' },
  { value: 'seasonal', label: '季節ごと' },
  { value: 'custom', label: 'カスタム' },
];

interface DraftStep {
  body: string;
  photoUris: string[];
}

async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

async function uploadPhoto(uri: string, noteId: string, stepIndex: number, photoIndex: number): Promise<string> {
  const compressed = await compressImage(uri);
  const response = await fetch(compressed);
  const blob = await response.blob();
  const path = `step-photos/${noteId}/step_${stepIndex}/photo_${photoIndex}_${Date.now()}.jpg`;

  const { error } = await supabase.storage.from('step-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export default function NewNoteScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { data: groupsData } = useMyGroups();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<NoteCategory>('other');
  const [status, setStatus] = useState<NoteStatus>('draft');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('none');
  const [steps, setSteps] = useState<DraftStep[]>([{ body: '', photoUris: [] }]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const createNote = useCreateNote();
  const createStep = useCreateStep();

  const groups = (groupsData ?? []).map((g) => ({ id: g.group_id, name: g.groups.name }));
  const groupId = groups[0]?.id ?? null;

  function addStep() {
    if (steps.length >= 30) {
      Alert.alert('上限', 'ステップは最大30個までです。');
      return;
    }
    setSteps([...steps, { body: '', photoUris: [] }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(index: number, body: string) {
    const next = [...steps];
    next[index] = { ...next[index], body };
    setSteps(next);
  }

  async function pickPhoto(stepIndex: number) {
    if ((steps[stepIndex].photoUris.length ?? 0) >= 3) {
      Alert.alert('上限', '1ステップあたり写真は最大3枚です。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const next = [...steps];
    next[stepIndex] = { ...next[stepIndex], photoUris: [...next[stepIndex].photoUris, result.assets[0].uri] };
    setSteps(next);
  }

  async function handleAiGenerate() {
    if (!title.trim()) {
      Alert.alert('タイトルを入力してください');
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-steps', {
        body: { title: title.trim() },
      });
      if (error) throw error;
      const generatedSteps: string[] = data.steps ?? [];
      setSteps(generatedSteps.slice(0, 30).map((body: string) => ({ body, photoUris: [] })));
    } catch (e: any) {
      Alert.alert('AI生成エラー', e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('タイトルを入力してください');
      return;
    }
    if (!groupId) {
      Alert.alert('グループが見つかりません');
      return;
    }

    const validSteps = steps.filter((s) => s.body.trim());
    setSaving(true);
    try {
      const note = await createNote.mutateAsync({
        group_id: groupId,
        created_by: userId!,
        title: title.trim(),
        category,
        status,
        frequency_type: frequencyType,
        frequency_config: null,
      });

      for (let i = 0; i < validSteps.length; i++) {
        const step = await createStep.mutateAsync({
          note_id: note.id,
          position: i + 1,
          body: validSteps[i].body.trim(),
        });

        for (let j = 0; j < validSteps[i].photoUris.length; j++) {
          const path = await uploadPhoto(validSteps[i].photoUris[j], note.id, i, j);
          await supabase.from('step_photos').insert({
            step_id: step.id,
            storage_path: path,
            position: j + 1,
          });
        }
      }

      router.replace(`/(app)/notes/${note.id}` as any);
    } catch (e: any) {
      Alert.alert('保存エラー', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* ヘッダー */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-ruled-line">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#2C2C2C" />
        </TouchableOpacity>
        <Text className="text-ink font-bold text-base">新しい手順書</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className={`bg-accent rounded-lg px-4 py-2 ${saving ? 'opacity-50' : ''}`}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text className="text-white font-semibold text-sm">保存</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* タイトル */}
        <View className="mb-4">
          <Text className="text-ink-light text-sm mb-1">タイトル *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="例: お風呂掃除"
            placeholderTextColor="#A09080"
            maxLength={100}
            className="bg-white border border-ruled-line rounded-lg px-4 py-3 text-ink text-base"
          />
        </View>

        {/* AI生成 */}
        <TouchableOpacity
          onPress={handleAiGenerate}
          disabled={aiLoading || !title.trim()}
          className={`border border-accent rounded-lg py-3 items-center mb-4 flex-row justify-center gap-2 ${
            aiLoading || !title.trim() ? 'opacity-40' : ''
          }`}
        >
          {aiLoading ? (
            <ActivityIndicator color="#E8734A" size="small" />
          ) : (
            <Text className="text-accent font-medium">✨ AIでステップを自動生成</Text>
          )}
        </TouchableOpacity>

        {/* カテゴリ */}
        <View className="mb-4">
          <Text className="text-ink-light text-sm mb-2">カテゴリ</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                onPress={() => setCategory(cat.value)}
                className={`px-3 py-2 rounded-lg border ${
                  category === cat.value ? 'bg-accent border-accent' : 'bg-white border-ruled-line'
                }`}
              >
                <Text className={category === cat.value ? 'text-white' : 'text-ink'}>
                  {cat.emoji} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 公開状態 */}
        <View className="mb-4">
          <Text className="text-ink-light text-sm mb-2">公開状態</Text>
          <View className="flex-row gap-2">
            {(['draft', 'published'] as NoteStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatus(s)}
                className={`flex-1 py-2 rounded-lg border items-center ${
                  status === s ? 'bg-accent border-accent' : 'bg-white border-ruled-line'
                }`}
              >
                <Text className={status === s ? 'text-white font-medium' : 'text-ink'}>
                  {s === 'draft' ? '下書き' : '公開'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 頻度 */}
        <View className="mb-6">
          <Text className="text-ink-light text-sm mb-2">実施頻度</Text>
          <View className="flex-row flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <TouchableOpacity
                key={f.value}
                onPress={() => setFrequencyType(f.value)}
                className={`px-3 py-2 rounded-lg border ${
                  frequencyType === f.value ? 'bg-accent border-accent' : 'bg-white border-ruled-line'
                }`}
              >
                <Text className={frequencyType === f.value ? 'text-white text-sm' : 'text-ink text-sm'}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ステップ */}
        <View>
          <Text className="text-ink font-semibold text-base mb-3">
            ステップ ({steps.length}/30)
          </Text>

          {steps.map((step, index) => (
            <View key={index} className="mb-3 bg-white border border-ruled-line rounded-xl p-3">
              <View className="flex-row items-center mb-2">
                <View className="w-6 h-6 rounded-full bg-accent items-center justify-center mr-2">
                  <Text className="text-white text-xs font-bold">{index + 1}</Text>
                </View>
                <Text className="text-ink-light text-xs">ステップ {index + 1}</Text>
                <TouchableOpacity onPress={() => removeStep(index)} className="ml-auto p-1">
                  <Ionicons name="trash-outline" size={16} color="#A09080" />
                </TouchableOpacity>
              </View>

              <TextInput
                value={step.body}
                onChangeText={(t) => updateStep(index, t)}
                placeholder="手順の説明を入力..."
                placeholderTextColor="#A09080"
                multiline
                maxLength={500}
                className="text-ink text-sm leading-relaxed min-h-16"
              />

              <TouchableOpacity
                onPress={() => pickPhoto(index)}
                className="mt-2 border border-dashed border-ruled-line rounded-lg py-2 items-center"
              >
                <Text className="text-ink-light text-xs">
                  📷 写真を追加 ({step.photoUris.length}/3)
                </Text>
              </TouchableOpacity>

              {step.photoUris.length > 0 && (
                <Text className="text-accent text-xs mt-1">
                  写真 {step.photoUris.length}枚選択済み
                </Text>
              )}
            </View>
          ))}

          <TouchableOpacity
            onPress={addStep}
            className="border border-dashed border-accent rounded-xl py-3 items-center"
          >
            <Text className="text-accent font-medium">＋ ステップを追加</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
