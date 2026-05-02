import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMyGroups,
  useGroupMembers,
  useCreateGroup,
  useUpdateGroup,
  useCreateInvitation,
  useActiveInvitation,
  useUpdateMemberRole,
  useRemoveMember,
  useLeaveGroup,
} from '@/hooks/useGroups';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { MemberRole } from '@/types/database';

const DEEP_LINK_BASE = 'kajinote://join';

const ROLE_LABELS: Record<MemberRole, string> = {
  admin: '管理者',
  editor: '編集メンバー',
  viewer: '閲覧メンバー',
};

export default function GroupSettingsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { data: groupsData, isLoading: groupsLoading } = useMyGroups();

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const createGroup = useCreateGroup();

  const groups = (groupsData ?? []).map((g) => ({
    id: g.group_id,
    name: g.groups.name,
    role: g.role,
  }));
  const currentGroupId = activeGroupId ?? groups[0]?.id ?? null;
  const currentGroup = groups.find((g) => g.id === currentGroupId);
  const isAdmin = currentGroup?.role === 'admin';

  const { data: members, isLoading: membersLoading } = useGroupMembers(currentGroupId);
  const { data: invitation } = useActiveInvitation(currentGroupId);
  const createInvitation = useCreateInvitation(currentGroupId);
  const updateMemberRole = useUpdateMemberRole(currentGroupId);
  const removeMember = useRemoveMember(currentGroupId);
  const leaveGroup = useLeaveGroup();
  const updateGroup = useUpdateGroup(currentGroupId);

  const [editingName, setEditingName] = useState('');
  const [showNameEdit, setShowNameEdit] = useState(false);

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    try {
      await createGroup.mutateAsync({ name: newGroupName.trim() });
      setNewGroupName('');
      setShowCreateGroup(false);
    } catch (e: any) {
      Alert.alert('エラー', e.message);
    }
  }

  async function handleShareInvite() {
    try {
      let token = invitation?.token;
      if (!token) {
        const result = await createInvitation.mutateAsync();
        token = result?.token;
      }
      const link = `${DEEP_LINK_BASE}/${token}`;
      await Share.share({
        message: `「${currentGroup?.name}」グループへの招待リンクです\n${link}`,
        url: link,
      });
    } catch (e: any) {
      Alert.alert('エラー', e.message);
    }
  }

  async function handleUpdateGroupName() {
    if (!editingName.trim()) return;
    try {
      await updateGroup.mutateAsync({ name: editingName.trim() });
      setShowNameEdit(false);
    } catch (e: any) {
      Alert.alert('エラー', e.message);
    }
  }

  async function handleLeaveGroup() {
    Alert.alert('グループを退出', `「${currentGroup?.name}」を退出しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroup.mutateAsync(currentGroupId!);
            router.back();
          } catch (e: any) {
            Alert.alert('エラー', e.message);
          }
        },
      },
    ]);
  }

  function handleChangeRole(memberId: string, currentRole: MemberRole) {
    const roles: MemberRole[] = ['viewer', 'editor', 'admin'];
    const options = roles
      .filter((r) => r !== currentRole)
      .map((r) => ({
        text: ROLE_LABELS[r],
        onPress: () =>
          updateMemberRole.mutateAsync({ memberId, role: r }).catch((e) =>
            Alert.alert('エラー', e.message),
          ),
      }));
    Alert.alert('権限を変更', undefined, [...options, { text: 'キャンセル', style: 'cancel' }]);
  }

  async function handleRemoveMember(memberId: string, name: string) {
    Alert.alert('メンバーを除名', `${name} さんをグループから除名しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '除名',
        style: 'destructive',
        onPress: () =>
          removeMember.mutateAsync(memberId).catch((e) => Alert.alert('エラー', e.message)),
      },
    ]);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (groupsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#E8734A" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <View className="flex-row items-center px-4 py-3 border-b border-ruled-line">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#2C2C2C" />
        </TouchableOpacity>
        <Text className="text-ink font-bold text-lg flex-1">グループ設定</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* グループ切り替え */}
        {groups.length > 1 && (
          <View className="mb-4">
            <Text className="text-ink-light text-sm mb-2">グループを選択</Text>
            {groups.map((g) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setActiveGroupId(g.id)}
                className={`flex-row items-center p-3 rounded-lg mb-2 border ${
                  currentGroupId === g.id ? 'border-accent bg-orange-50' : 'border-ruled-line bg-white'
                }`}
              >
                <Text className={`flex-1 font-medium ${currentGroupId === g.id ? 'text-accent' : 'text-ink'}`}>
                  {g.name}
                </Text>
                <Text className="text-ink-light text-xs">{ROLE_LABELS[g.role]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* グループ作成 */}
        <View className="mb-6">
          {!showCreateGroup ? (
            <TouchableOpacity
              onPress={() => setShowCreateGroup(true)}
              className="border border-dashed border-accent rounded-lg py-3 items-center"
            >
              <Text className="text-accent font-medium">＋ 新しいグループを作成</Text>
            </TouchableOpacity>
          ) : (
            <View className="bg-white border border-ruled-line rounded-lg p-4">
              <Text className="text-ink font-semibold mb-2">新しいグループ</Text>
              <TextInput
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="グループ名（1〜50文字）"
                placeholderTextColor="#A09080"
                maxLength={50}
                className="border border-ruled-line rounded-lg px-3 py-2 text-ink mb-3"
              />
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowCreateGroup(false)}
                  className="flex-1 border border-ruled-line rounded-lg py-2 items-center"
                >
                  <Text className="text-ink-light">キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateGroup}
                  disabled={createGroup.isPending}
                  className="flex-1 bg-accent rounded-lg py-2 items-center"
                >
                  {createGroup.isPending ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">作成</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {currentGroupId && currentGroup && (
          <>
            {/* グループ名 */}
            <View className="bg-white border border-ruled-line rounded-xl p-4 mb-4">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-ink font-semibold text-lg">{currentGroup.name}</Text>
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => { setEditingName(currentGroup.name); setShowNameEdit(!showNameEdit); }}
                    className="p-1"
                  >
                    <Ionicons name="pencil-outline" size={18} color="#A09080" />
                  </TouchableOpacity>
                )}
              </View>
              <Text className="text-ink-light text-sm">{ROLE_LABELS[currentGroup.role]}</Text>

              {showNameEdit && isAdmin && (
                <View className="mt-3">
                  <TextInput
                    value={editingName}
                    onChangeText={setEditingName}
                    maxLength={50}
                    className="border border-ruled-line rounded-lg px-3 py-2 text-ink mb-2"
                  />
                  <TouchableOpacity
                    onPress={handleUpdateGroupName}
                    className="bg-accent rounded-lg py-2 items-center"
                  >
                    <Text className="text-white font-semibold">更新</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 招待リンク */}
            {isAdmin && (
              <View className="bg-white border border-ruled-line rounded-xl p-4 mb-4">
                <Text className="text-ink font-semibold mb-2">メンバーを招待</Text>
                <TouchableOpacity
                  onPress={handleShareInvite}
                  disabled={createInvitation.isPending}
                  className="bg-accent rounded-lg py-3 items-center"
                >
                  {createInvitation.isPending ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">🔗 招待リンクを共有</Text>
                  )}
                </TouchableOpacity>
                {invitation && (
                  <Text className="text-ink-light text-xs mt-2 text-center">
                    有効期限: {new Date(invitation.expires_at).toLocaleDateString('ja-JP')}
                  </Text>
                )}
              </View>
            )}

            {/* メンバー一覧 */}
            <View className="bg-white border border-ruled-line rounded-xl p-4 mb-4">
              <Text className="text-ink font-semibold mb-3">
                メンバー ({members?.length ?? 0}/20)
              </Text>
              {membersLoading ? (
                <ActivityIndicator color="#E8734A" />
              ) : (
                members?.map((m) => (
                  <View key={m.id} className="flex-row items-center py-2 border-b border-cream-dark last:border-0">
                    <View className="w-8 h-8 rounded-full bg-cream-dark items-center justify-center mr-3">
                      <Text className="text-ink font-bold text-sm">
                        {m.profiles.display_name[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-ink font-medium text-sm">
                        {m.profiles.display_name}
                        {m.user_id === userId ? ' (自分)' : ''}
                      </Text>
                      <Text className="text-ink-light text-xs">{ROLE_LABELS[m.role]}</Text>
                    </View>
                    {isAdmin && m.user_id !== userId && (
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => handleChangeRole(m.id, m.role)}
                          className="p-1"
                        >
                          <Ionicons name="swap-horizontal-outline" size={18} color="#A09080" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRemoveMember(m.id, m.profiles.display_name)}
                          className="p-1"
                        >
                          <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* 退出ボタン */}
            {currentGroup.role !== 'admin' && (
              <TouchableOpacity
                onPress={handleLeaveGroup}
                className="border border-red-200 rounded-xl py-3 items-center mb-4"
              >
                <Text className="text-red-500 font-medium">グループを退出</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ログアウト */}
        <View className="border-t border-ruled-line pt-4 mt-4">
          <TouchableOpacity
            onPress={handleSignOut}
            className="border border-ruled-line rounded-xl py-3 items-center"
          >
            <Text className="text-ink-light font-medium">ログアウト</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
