-- ============================================================
-- kaji-note storage setup
-- Supabase Storage buckets + RLS policies on storage.objects
-- ============================================================
--
-- Path convention (stored in DB columns like storage_path / avatar_url):
--   Full path = {bucket_id}/{object_key}
--   e.g. "step-photos/note-uuid/step-uuid/photo-uuid.jpg"
--
-- storage.objects.name stores only the object_key (without bucket prefix).
-- Supabase client usage:
--   upload : storage.from(bucket).upload(objectKey, file)
--   signedUrl: storage.from(bucket).createSignedUrl(objectKey, ttl)
-- ============================================================

-- ============================================================
-- BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- User profile pictures. One file per user; path = {user_id}/avatar.jpg
  (
    'avatars',
    'avatars',
    false,
    2097152,   -- 2 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  -- Group thumbnail icons. One file per group; path = {group_id}/icon.jpg
  (
    'group-icons',
    'group-icons',
    false,
    2097152,   -- 2 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  -- Step photos. Up to 3 per step; path = {note_id}/{step_id}/{photo_id}.jpg
  -- Client must compress to ≤ 1280px / ~80% quality before upload.
  (
    'step-photos',
    'step-photos',
    false,
    5242880,   -- 5 MB (post-compression safety margin)
    ARRAY['image/jpeg', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE RLS POLICIES — avatars
--
-- Path inside bucket: {user_id}/avatar.{ext}
-- Read : any authenticated user (profiles are globally visible)
-- Write: the owner only (first path segment = auth.uid())
-- ============================================================

CREATE POLICY "avatars_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- STORAGE RLS POLICIES — group-icons
--
-- Path inside bucket: {group_id}/icon.{ext}
-- Read : group members only
-- Write: group admins only
-- ============================================================

CREATE POLICY "group_icons_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'group-icons'
    AND is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "group_icons_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-icons'
    AND is_group_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "group_icons_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'group-icons'
    AND is_group_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "group_icons_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group-icons'
    AND is_group_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ============================================================
-- STORAGE RLS POLICIES — step-photos
--
-- Path inside bucket: {note_id}/{step_id}/{photo_id}.jpg
-- Read : group members for published notes; draft author for their own drafts
-- Write: admin / editor (can_edit_in_group); no UPDATE (delete + re-upload)
-- ============================================================

CREATE POLICY "step_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'step-photos'
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id        = (storage.foldername(name))[1]::uuid
        AND notes.deleted_at IS NULL
        AND (
          (notes.status = 'published' AND is_group_member(notes.group_id, auth.uid()))
          OR (notes.status = 'draft'  AND notes.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "step_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'step-photos'
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id        = (storage.foldername(name))[1]::uuid
        AND notes.deleted_at IS NULL
        AND can_edit_in_group(notes.group_id, auth.uid())
    )
  );

-- No UPDATE policy: photos are replaced by delete + re-upload.

CREATE POLICY "step_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'step-photos'
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id        = (storage.foldername(name))[1]::uuid
        AND notes.deleted_at IS NULL
        AND can_edit_in_group(notes.group_id, auth.uid())
    )
  );
