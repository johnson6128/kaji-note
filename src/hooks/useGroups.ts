import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { Group, GroupMemberWithProfile, GroupWithRole } from '@/types/database';

export function useMyGroups() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['groups', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, role, groups(*)')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []) as GroupWithRole[];
    },
    enabled: !!userId,
  });
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('*, profiles(*)')
        .eq('group_id', groupId!);
      if (error) throw error;
      return (data ?? []) as GroupMemberWithProfile[];
    },
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data, error } = await supabase
        .from('groups')
        .insert({ name, created_by: userId! })
        .select()
        .single();
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', userId] });
    },
  });
}

export function useUpdateGroup(groupId: string | null) {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data, error } = await supabase
        .from('groups')
        .update({ name })
        .eq('id', groupId!)
        .select()
        .single();
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', userId] });
    },
  });
}

export function useActiveInvitation(groupId: string | null) {
  return useQuery({
    queryKey: ['group-invitations', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_invitations')
        .select('*')
        .eq('group_id', groupId!)
        .is('invalidated_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });
}

export function useCreateInvitation(groupId: string | null) {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('group_invitations')
        .insert({ group_id: groupId!, created_by: userId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-invitations', groupId] });
    },
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data: invitation, error: invErr } = await supabase
        .from('group_invitations')
        .select('*')
        .eq('token', token)
        .single();
      if (invErr || !invitation) throw new Error('無効な招待リンクです');

      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', invitation.group_id);

      if ((count ?? 0) >= 20) throw new Error('グループの上限（20名）に達しています');

      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: invitation.group_id, user_id: userId!, role: 'viewer' });
      if (error) throw error;
      return invitation.group_id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', userId] });
    },
  });
}

export function useUpdateMemberRole(groupId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { error } = await supabase
        .from('group_members')
        .update({ role })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
  });
}

export function useRemoveMember(groupId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('group_members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', userId] });
    },
  });
}
