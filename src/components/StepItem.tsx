import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import type { StepWithPhotos } from '@/types/database';

interface StepItemProps {
  step: StepWithPhotos;
  stepNumber: number;
  isExecutionMode?: boolean;
  isCompleted?: boolean;
  onComplete?: () => void;
}

function PhotoItem({ storagePath }: { storagePath: string }) {
  const { data } = supabase.storage.from('step-photos').getPublicUrl(storagePath);
  return (
    <Image
      source={{ uri: data.publicUrl }}
      className="w-32 h-32 rounded-lg mr-2"
      resizeMode="cover"
    />
  );
}

export function StepItem({
  step,
  stepNumber,
  isExecutionMode = false,
  isCompleted = false,
  onComplete,
}: StepItemProps) {
  return (
    <View
      className={`mb-4 rounded-xl p-4 ${isCompleted ? 'bg-green-50 border border-green-200' : 'bg-white border border-ruled-line'}`}
    >
      <View className="flex-row items-start">
        {/* ステップ番号 */}
        <View
          className={`w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5 flex-shrink-0 ${
            isCompleted ? 'bg-green-500' : 'bg-accent'
          }`}
        >
          {isCompleted ? (
            <Ionicons name="checkmark" size={16} color="#ffffff" />
          ) : (
            <Text className="text-white font-bold text-sm">{stepNumber}</Text>
          )}
        </View>

        {/* テキスト */}
        <View className="flex-1">
          <Text className={`text-base leading-relaxed ${isCompleted ? 'text-ink-light line-through' : 'text-ink'}`}>
            {step.body}
          </Text>
        </View>

        {/* 実行モードの完了ボタン */}
        {isExecutionMode && !isCompleted && onComplete && (
          <TouchableOpacity
            onPress={onComplete}
            className="ml-2 bg-accent rounded-lg px-3 py-1.5 flex-shrink-0"
          >
            <Text className="text-white text-xs font-medium">完了</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 写真 */}
      {step.step_photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
        >
          {step.step_photos.map((photo) => (
            <PhotoItem key={photo.id} storagePath={photo.storage_path} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
