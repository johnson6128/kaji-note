export type MemberRole = 'admin' | 'editor' | 'viewer';
export type NoteStatus = 'draft' | 'published';
export type NoteCategory = 'cleaning' | 'cooking' | 'laundry' | 'storage' | 'other';
export type FrequencyType = 'none' | 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'custom';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  icon_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  invalidated_at: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  category: NoteCategory;
  status: NoteStatus;
  frequency_type: FrequencyType;
  frequency_config: Record<string, unknown> | null;
  next_scheduled_date: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Step {
  id: string;
  note_id: string;
  position: number;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface StepPhoto {
  id: string;
  step_id: string;
  storage_path: string;
  position: number;
  created_at: string;
}

export interface Execution {
  id: string;
  note_id: string;
  executed_by: string;
  executed_at: string;
  created_at: string;
}

export interface ShareLink {
  id: string;
  note_id: string;
  token: string;
  created_by: string;
  invalidated_at: string | null;
  created_at: string;
}

export interface StepWithPhotos extends Step {
  step_photos: StepPhoto[];
}

export interface NoteWithSteps extends Note {
  steps: StepWithPhotos[];
}

export interface GroupWithRole {
  group_id: string;
  role: MemberRole;
  groups: Group;
}

export interface GroupMemberWithProfile extends GroupMember {
  profiles: Profile;
}

export interface WeeklyConfig {
  days: number[];
}

export interface MonthlyConfig {
  day: number;
}

export interface CustomConfig {
  interval_days: number;
}

export type FrequencyConfig = WeeklyConfig | MonthlyConfig | CustomConfig | null;

export interface CreateNoteInput {
  group_id: string;
  created_by: string;
  title: string;
  category: NoteCategory;
  status: NoteStatus;
  frequency_type: FrequencyType;
  frequency_config?: Record<string, unknown> | null;
}

export interface UpdateNoteInput {
  title?: string;
  category?: NoteCategory;
  status?: NoteStatus;
  frequency_type?: FrequencyType;
  frequency_config?: Record<string, unknown> | null;
}

export interface CreateStepInput {
  note_id: string;
  position: number;
  body: string;
}

export interface UpdateStepInput {
  position?: number;
  body?: string;
}
