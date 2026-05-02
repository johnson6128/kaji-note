import { TouchableOpacity, View, Text } from 'react-native';
import type { Note, NoteCategory } from '@/types/database';
import { FrequencyBadge } from './FrequencyBadge';

interface NoteCardProps {
  note: Note;
  onPress: () => void;
}

const CATEGORY_INFO: Record<NoteCategory, { label: string; emoji: string }> = {
  cleaning: { label: '掃除', emoji: '🧹' },
  cooking: { label: '料理', emoji: '🍳' },
  laundry: { label: '洗濯', emoji: '👕' },
  storage: { label: '収納', emoji: '📦' },
  other: { label: 'その他', emoji: '📝' },
};

export function NoteCard({ note, onPress }: NoteCardProps) {
  const cat = CATEGORY_INFO[note.category];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-cream-dark rounded-xl p-4 m-1.5 flex-1"
      style={{
        borderLeftWidth: 6,
        borderLeftColor: '#E8734A',
        shadowColor: '#2C2C2C',
        shadowOffset: { width: 1, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 2,
        minHeight: 110,
      }}
    >
      <Text className="text-center mb-1" style={{ fontSize: 24 }}>
        {cat.emoji}
      </Text>
      <Text
        className="text-ink font-semibold text-center leading-tight"
        numberOfLines={2}
        style={{ fontSize: 13 }}
      >
        {note.title}
      </Text>
      <View className="mt-2 items-center gap-1">
        <FrequencyBadge
          frequencyType={note.frequency_type}
          nextScheduledDate={note.next_scheduled_date}
        />
        {note.status === 'draft' && (
          <Text className="text-ink-light text-xs">下書き</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
