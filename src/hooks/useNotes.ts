import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type {
  Note,
  NoteWithSteps,
  Step,
  CreateNoteInput,
  UpdateNoteInput,
  CreateStepInput,
  UpdateStepInput,
} from '@/types/database';

export function useNotes(groupId: string | null) {
  return useQuery({
    queryKey: ['notes', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
    enabled: !!groupId,
  });
}

export function useNote(noteId: string | null) {
  return useQuery({
    queryKey: ['note', noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*, steps(*, step_photos(*))')
        .eq('id', noteId!)
        .single();
      if (error) throw error;
      const note = data as NoteWithSteps;
      note.steps = (note.steps ?? []).sort((a, b) => a.position - b.position);
      note.steps.forEach((s) => {
        s.step_photos = (s.step_photos ?? []).sort((a, b) => a.position - b.position);
      });
      return note;
    },
    enabled: !!noteId,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      const { data, error } = await supabase.from('notes').insert(input).select().single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes', note.group_id] });
    },
  });
}

export function useUpdateNote(noteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateNoteInput) => {
      const { data, error } = await supabase
        .from('notes')
        .update(input)
        .eq('id', noteId!)
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['note', noteId] });
      qc.invalidateQueries({ queryKey: ['notes', note.group_id] });
    },
  });
}

export function useSoftDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, groupId }: { noteId: string; groupId: string }) => {
      const { error } = await supabase.rpc('soft_delete_note', { p_note_id: noteId });
      if (error) throw error;
      return { noteId, groupId };
    },
    onSuccess: ({ noteId, groupId }) => {
      qc.invalidateQueries({ queryKey: ['notes', groupId] });
      qc.removeQueries({ queryKey: ['note', noteId] });
    },
  });
}

export function useCreateExecution() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ noteId }: { noteId: string }) => {
      const { data, error } = await supabase
        .from('executions')
        .insert({ note_id: noteId, executed_by: userId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['note', variables.noteId] });
    },
  });
}

export function useCreateStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStepInput) => {
      const { data, error } = await supabase.from('steps').insert(input).select().single();
      if (error) throw error;
      return data as Step;
    },
    onSuccess: (step) => {
      qc.invalidateQueries({ queryKey: ['note', step.note_id] });
    },
  });
}

export function useUpdateStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stepId,
      noteId,
      input,
    }: {
      stepId: string;
      noteId: string;
      input: UpdateStepInput;
    }) => {
      const { data, error } = await supabase
        .from('steps')
        .update(input)
        .eq('id', stepId)
        .select()
        .single();
      if (error) throw error;
      return { step: data as Step, noteId };
    },
    onSuccess: ({ noteId }) => {
      qc.invalidateQueries({ queryKey: ['note', noteId] });
    },
  });
}

export function useDeleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stepId, noteId }: { stepId: string; noteId: string }) => {
      const { error } = await supabase.from('steps').delete().eq('id', stepId);
      if (error) throw error;
      return noteId;
    },
    onSuccess: (noteId) => {
      qc.invalidateQueries({ queryKey: ['note', noteId] });
    },
  });
}

export function useShareLink(noteId: string | null) {
  const { userId } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['share-link', noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('share_links')
        .select('*')
        .eq('note_id', noteId!)
        .is('invalidated_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!noteId,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('share_links')
        .insert({ note_id: noteId!, created_by: userId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['share-link', noteId] });
    },
  });

  return { query, create };
}
