import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyGroups } from '@/hooks/useGroups';
import { useNotes } from '@/hooks/useNotes';
import { NoteCard } from '@/components/NoteCard';
import type { Note } from '@/types/database';

export default function HomeScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const { data: groupsData, isLoading: groupsLoading } = useMyGroups();

  const groups = useMemo(
    () => (groupsData ?? []).map((g) => ({ id: g.group_id, name: g.groups.name, role: g.role })),
    [groupsData],
  );

  const currentGroupId = activeGroupId ?? groups[0]?.id ?? null;

  const { data: notes, isLoading: notesLoading, refetch } = useNotes(currentGroupId);

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    if (!searchQuery.trim()) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [notes, searchQuery]);

  if (groupsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#E8734A" size="large" />
      </SafeAreaView>
    );
  }

  if (groups.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-cream">
        <View className="px-4 pt-6 pb-4 border-b border-ruled-line">
          <Text className="text-2xl font-bold text-ink">kaji-note</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">📒</Text>
          <Text className="text-ink font-semibold text-xl mb-2 text-center">
            グループに参加しましょう
          </Text>
          <Text className="text-ink-light text-center text-sm mb-8">
            グループを作成するか、招待リンクから参加してください。
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/group-settings' as any)}
            className="bg-accent rounded-lg py-4 px-8"
          >
            <Text className="text-white font-semibold text-base">グループを作成</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* ヘッダー */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-ink">kaji-note</Text>
        <TouchableOpacity
          onPress={() => router.push('/(app)/group-settings' as any)}
          className="p-2"
        >
          <Ionicons name="settings-outline" size={22} color="#2C2C2C" />
        </TouchableOpacity>
      </View>

      {/* グループ切り替えタブ */}
      {groups.length > 1 && (
        <View className="px-4 pb-2">
          <FlatList
            data={groups}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(g) => g.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setActiveGroupId(item.id)}
                className={`mr-2 px-4 py-2 rounded-full border ${
                  currentGroupId === item.id
                    ? 'bg-accent border-accent'
                    : 'bg-white border-ruled-line'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    currentGroupId === item.id ? 'text-white' : 'text-ink'
                  }`}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View className="border-b border-ruled-line mx-4" />

      {/* 検索バー */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-white border border-ruled-line rounded-lg px-3 py-2">
          <Ionicons name="search-outline" size={18} color="#A09080" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="手順書を検索..."
            placeholderTextColor="#A09080"
            className="flex-1 ml-2 text-ink text-sm"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#A09080" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ノート一覧 */}
      {notesLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#E8734A" size="large" />
        </View>
      ) : filteredNotes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">📖</Text>
          <Text className="text-ink font-semibold text-lg mb-2">
            {searchQuery ? '見つかりませんでした' : '手順書がありません'}
          </Text>
          {!searchQuery && (
            <Text className="text-ink-light text-center text-sm">
              右下の「＋」ボタンで手順書を作成しましょう
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#E8734A" />
          }
          renderItem={({ item }: { item: Note }) => (
            <NoteCard
              note={item}
              onPress={() => router.push(`/(app)/notes/${item.id}` as any)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/notes/new' as any)}
        className="absolute bottom-8 right-6 bg-accent w-14 h-14 rounded-full items-center justify-center"
        style={{
          shadowColor: '#E8734A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
