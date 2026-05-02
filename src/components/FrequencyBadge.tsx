import { View, Text } from 'react-native';
import type { FrequencyType } from '@/types/database';

interface FrequencyBadgeProps {
  frequencyType: FrequencyType;
  nextScheduledDate: string | null;
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function FrequencyBadge({ frequencyType, nextScheduledDate }: FrequencyBadgeProps) {
  if (frequencyType === 'none' || !nextScheduledDate) return null;

  const days = getDaysUntil(nextScheduledDate);

  if (days < 0) {
    return (
      <View className="bg-red-100 rounded-full px-2 py-0.5">
        <Text className="text-red-600 text-xs font-medium">期限超過</Text>
      </View>
    );
  }

  if (days === 0) {
    return (
      <View className="bg-orange-100 rounded-full px-2 py-0.5">
        <Text className="text-accent text-xs font-medium">今日</Text>
      </View>
    );
  }

  if (days <= 3) {
    return (
      <View className="bg-yellow-100 rounded-full px-2 py-0.5">
        <Text className="text-yellow-700 text-xs font-medium">{days}日後</Text>
      </View>
    );
  }

  return (
    <View className="bg-cream-dark rounded-full px-2 py-0.5">
      <Text className="text-ink-light text-xs">{days}日後</Text>
    </View>
  );
}
