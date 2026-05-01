-- ============================================================
-- kaji-note initial schema
-- Supabase / PostgreSQL 15
-- ============================================================

-- pgcrypto provides gen_random_bytes() used for token generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE member_role    AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE note_status    AS ENUM ('draft', 'published');
CREATE TYPE note_category  AS ENUM ('cleaning', 'cooking', 'laundry', 'storage', 'other');
CREATE TYPE frequency_type AS ENUM ('none', 'daily', 'weekly', 'monthly', 'seasonal', 'custom');

-- ============================================================
-- PROFILES  (mirrors auth.users 1:1)
-- ============================================================

CREATE TABLE profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 30),
  avatar_url   TEXT,                        -- Storage path: avatars/{id}/avatar.jpg
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile row when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',   -- populated by Google OAuth
      split_part(NEW.email, '@', 1)           -- fallback: email local-part
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- GROUPS
-- ============================================================

CREATE TABLE groups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  icon_url   TEXT,                          -- Storage path: group-icons/{id}/icon.jpg
  created_by UUID        NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================

CREATE TABLE group_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      member_role NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Auto-add the group creator as admin when a group is created
CREATE OR REPLACE FUNCTION handle_new_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_created
  AFTER INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION handle_new_group();

-- ============================================================
-- GROUP INVITATIONS
-- ============================================================

CREATE TABLE group_invitations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- URL-safe token; knowing the token is the permission to join
  token          TEXT        NOT NULL UNIQUE
                               DEFAULT encode(gen_random_bytes(18), 'hex'),
  created_by     UUID        NOT NULL REFERENCES profiles(id),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  invalidated_at TIMESTAMPTZ,              -- set by admin to revoke before expiry
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX group_invitations_token_idx ON group_invitations (token);

-- ============================================================
-- NOTES  (手順書)
-- ============================================================

CREATE TABLE notes (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID           NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by          UUID           NOT NULL REFERENCES profiles(id),
  title               TEXT           NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  category            note_category  NOT NULL DEFAULT 'other',
  status              note_status    NOT NULL DEFAULT 'draft',

  -- Frequency settings (UC-03-4 / F-04)
  frequency_type      frequency_type NOT NULL DEFAULT 'none',
  -- JSONB shape per frequency_type:
  --   none, daily, seasonal  -> NULL
  --   weekly                 -> {"days": [1,3,5]}  (1=Mon … 7=Sun, ISO weekday)
  --   monthly                -> {"day": 15}        (1-31; clamped to month-end)
  --   custom                 -> {"interval_days": 14}
  frequency_config    JSONB          CHECK (
    (frequency_type IN ('none','daily','seasonal') AND frequency_config IS NULL)
    OR frequency_type IN ('weekly','monthly','custom')
  ),

  next_scheduled_date DATE,                 -- recalculated on each execution INSERT
  deleted_at          TIMESTAMPTZ,          -- logical delete (F-03-4)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notes_group_status_idx
  ON notes (group_id, status, next_scheduled_date)
  WHERE deleted_at IS NULL;

-- ============================================================
-- STEPS
-- ============================================================

CREATE TABLE steps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    UUID        NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  position   SMALLINT    NOT NULL CHECK (position BETWEEN 1 AND 30),
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (note_id, position)
);

CREATE INDEX steps_note_position_idx ON steps (note_id, position);

-- ============================================================
-- STEP PHOTOS
-- ============================================================

CREATE TABLE step_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id      UUID        NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  -- Storage path: step-photos/{note_id}/{step_id}/{id}.jpg
  storage_path TEXT        NOT NULL,
  position     SMALLINT    NOT NULL CHECK (position BETWEEN 1 AND 3),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (step_id, position)
);

-- ============================================================
-- EXECUTIONS  (実施記録)
-- ============================================================

CREATE TABLE executions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID        NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  executed_by UUID        NOT NULL REFERENCES profiles(id),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX executions_note_time_idx ON executions (note_id, executed_at DESC);

-- ============================================================
-- SHARE LINKS  (閲覧専用リンク, F-06-2)
-- ============================================================

CREATE TABLE share_links (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        UUID        NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  token          TEXT        NOT NULL UNIQUE
                               DEFAULT encode(gen_random_bytes(18), 'hex'),
  created_by     UUID        NOT NULL REFERENCES profiles(id),
  invalidated_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX share_links_token_idx ON share_links (token);

-- ============================================================
-- UPDATED_AT MAINTENANCE
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_groups_updated_at
  BEFORE UPDATE ON groups   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON notes    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_steps_updated_at
  BEFORE UPDATE ON steps    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- NEXT SCHEDULED DATE CALCULATION  (F-04-2)
-- ============================================================

-- Pure function: compute the next due date given frequency settings and
-- the date the note was last executed.
CREATE OR REPLACE FUNCTION calc_next_scheduled_date(
  p_frequency_type   frequency_type,
  p_frequency_config JSONB,
  p_base_date        DATE
) RETURNS DATE LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_day        INT;
  v_interval   INT;
  v_days       INT[];
  v_candidate  DATE;
  i            INT;
  v_next_month DATE;
  v_last_day   INT;
BEGIN
  CASE p_frequency_type
    WHEN 'none' THEN
      RETURN NULL;

    WHEN 'daily' THEN
      RETURN p_base_date + 1;

    WHEN 'weekly' THEN
      -- days: ISO weekdays (1=Mon … 7=Sun), pick the nearest next matching day
      v_days := ARRAY(
        SELECT (jsonb_array_elements_text(p_frequency_config->'days'))::INT
        ORDER BY 1
      );
      IF array_length(v_days, 1) IS NULL THEN
        RETURN p_base_date + 7;
      END IF;
      FOR i IN 1..7 LOOP
        v_candidate := p_base_date + i;
        IF EXTRACT(ISODOW FROM v_candidate)::INT = ANY(v_days) THEN
          RETURN v_candidate;
        END IF;
      END LOOP;
      RETURN p_base_date + 7; -- should never reach here

    WHEN 'monthly' THEN
      v_day        := COALESCE((p_frequency_config->>'day')::INT, 1);
      v_next_month := date_trunc('month', p_base_date + INTERVAL '1 month')::DATE;
      -- last day of that month
      v_last_day   := EXTRACT(
        DAY FROM (v_next_month + INTERVAL '1 month' - INTERVAL '1 day')
      )::INT;
      RETURN v_next_month + (LEAST(v_day, v_last_day) - 1);

    WHEN 'seasonal' THEN
      RETURN (p_base_date + INTERVAL '3 months')::DATE;

    WHEN 'custom' THEN
      v_interval := COALESCE((p_frequency_config->>'interval_days')::INT, 1);
      RETURN p_base_date + v_interval;

    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- Trigger: update notes.next_scheduled_date whenever an execution is recorded
CREATE OR REPLACE FUNCTION handle_new_execution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_note notes%ROWTYPE;
BEGIN
  SELECT * INTO v_note FROM notes WHERE id = NEW.note_id;
  UPDATE notes
  SET next_scheduled_date = calc_next_scheduled_date(
        v_note.frequency_type,
        v_note.frequency_config,
        NEW.executed_at::DATE
      ),
      updated_at = now()
  WHERE id = NEW.note_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_execution_created
  AFTER INSERT ON executions
  FOR EACH ROW EXECUTE FUNCTION handle_new_execution();

-- ============================================================
-- SOFT DELETE RPC  (enforces per-role delete rules, F-02-2)
-- ============================================================

-- Editors may delete only their own notes; admins may delete any note.
-- Because this boundary cannot be expressed purely in RLS (logical delete = UPDATE),
-- callers MUST use this RPC instead of writing deleted_at directly.
CREATE OR REPLACE FUNCTION soft_delete_note(p_note_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_note notes%ROWTYPE;
BEGIN
  SELECT * INTO v_note FROM notes WHERE id = p_note_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'note_not_found';
  END IF;

  IF NOT (
    -- admin: any note in the group
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = v_note.group_id
        AND user_id   = auth.uid()
        AND role      = 'admin'
    )
    OR
    -- editor: only own notes
    (
      v_note.created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = v_note.group_id
          AND user_id   = auth.uid()
          AND role      IN ('admin', 'editor')
      )
    )
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE notes SET deleted_at = now() WHERE id = p_note_id;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps             ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links       ENABLE ROW LEVEL SECURITY;

-- ---- helper functions (SECURITY DEFINER avoids recursive RLS) ----

CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION can_edit_in_group(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
      AND role IN ('admin', 'editor')
  );
$$;

-- ---- PROFILES ----

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (true);          -- any signed-in user may look up display names / avatars

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- INSERT handled by handle_new_user() trigger (SECURITY DEFINER)
-- DELETE cascades from auth.users

-- ---- GROUPS ----

CREATE POLICY "groups_select" ON groups
  FOR SELECT TO authenticated
  USING (is_group_member(id, auth.uid()));

CREATE POLICY "groups_insert" ON groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_update" ON groups
  FOR UPDATE TO authenticated
  USING (is_group_admin(id, auth.uid()));

-- ---- GROUP MEMBERS ----

CREATE POLICY "group_members_select" ON group_members
  FOR SELECT TO authenticated
  USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "group_members_insert" ON group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User joins themselves via an invitation link
    auth.uid() = user_id
    -- Admin adds someone else
    OR is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "group_members_update" ON group_members
  FOR UPDATE TO authenticated
  USING (is_group_admin(group_id, auth.uid()));

CREATE POLICY "group_members_delete" ON group_members
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id          -- leave group
    OR is_group_admin(group_id, auth.uid())
  );

-- ---- GROUP INVITATIONS ----
-- Tokens are effectively the secret; public read of valid invitations is intentional.

CREATE POLICY "group_invitations_select" ON group_invitations
  FOR SELECT TO authenticated, anon
  USING (invalidated_at IS NULL AND expires_at > now());

CREATE POLICY "group_invitations_insert" ON group_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "group_invitations_update" ON group_invitations
  FOR UPDATE TO authenticated
  USING (is_group_admin(group_id, auth.uid()));

-- ---- NOTES ----

CREATE POLICY "notes_select" ON notes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (status = 'published' AND is_group_member(group_id, auth.uid()))
      OR (status = 'draft'     AND created_by = auth.uid())
    )
  );

CREATE POLICY "notes_insert" ON notes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND can_edit_in_group(group_id, auth.uid())
  );

-- Covers content edits AND the deleted_at update.
-- Fine-grained delete authorization is enforced by soft_delete_note() RPC.
CREATE POLICY "notes_update" ON notes
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND can_edit_in_group(group_id, auth.uid())
  );

-- Physical DELETE is disabled (no policy = denied).

-- ---- STEPS ----

CREATE POLICY "steps_select" ON steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = steps.note_id
        AND notes.deleted_at IS NULL
        AND (
          (notes.status = 'published' AND is_group_member(notes.group_id, auth.uid()))
          OR (notes.status = 'draft'     AND notes.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "steps_insert" ON steps
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = steps.note_id
        AND notes.deleted_at IS NULL
        AND can_edit_in_group(notes.group_id, auth.uid())
    )
  );

CREATE POLICY "steps_update" ON steps
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = steps.note_id
        AND notes.deleted_at IS NULL
        AND can_edit_in_group(notes.group_id, auth.uid())
    )
  );

CREATE POLICY "steps_delete" ON steps
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = steps.note_id
        AND notes.deleted_at IS NULL
        AND can_edit_in_group(notes.group_id, auth.uid())
    )
  );

-- ---- STEP PHOTOS ----

CREATE POLICY "step_photos_select" ON step_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM steps
      JOIN notes ON notes.id = steps.note_id
      WHERE steps.id = step_photos.step_id
        AND notes.deleted_at IS NULL
        AND (
          (notes.status = 'published' AND is_group_member(notes.group_id, auth.uid()))
          OR (notes.status = 'draft'     AND notes.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "step_photos_insert" ON step_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM steps
      JOIN notes ON notes.id = steps.note_id
      WHERE steps.id = step_photos.step_id
        AND notes.deleted_at IS NULL
        AND can_edit_in_group(notes.group_id, auth.uid())
    )
  );

CREATE POLICY "step_photos_delete" ON step_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM steps
      JOIN notes ON notes.id = steps.note_id
      WHERE steps.id = step_photos.step_id
        AND notes.deleted_at IS NULL
        AND can_edit_in_group(notes.group_id, auth.uid())
    )
  );

-- ---- EXECUTIONS ----

CREATE POLICY "executions_select" ON executions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = executions.note_id
        AND notes.deleted_at IS NULL
        AND is_group_member(notes.group_id, auth.uid())
    )
  );

-- All group members (including viewers) can record an execution.
CREATE POLICY "executions_insert" ON executions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = executed_by
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = executions.note_id
        AND notes.deleted_at IS NULL
        AND notes.status = 'published'
        AND is_group_member(notes.group_id, auth.uid())
    )
  );

-- UPDATE / DELETE on executions: denied (immutable records).

-- ---- SHARE LINKS ----

-- Public read allows token-based note access by anonymous users.
CREATE POLICY "share_links_select" ON share_links
  FOR SELECT TO authenticated, anon
  USING (invalidated_at IS NULL);

CREATE POLICY "share_links_insert" ON share_links
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = share_links.note_id
        AND notes.status = 'published'
        AND can_edit_in_group(notes.group_id, auth.uid())
    )
  );

CREATE POLICY "share_links_update" ON share_links
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = share_links.note_id
        AND is_group_admin(notes.group_id, auth.uid())
    )
  );

-- ============================================================
-- STORAGE BUCKETS  (configure in Supabase Dashboard / CLI)
-- ============================================================
--
-- Bucket: avatars
--   path:    avatars/{user_id}/avatar.jpg
--   access:  authenticated read, owner write
--
-- Bucket: group-icons
--   path:    group-icons/{group_id}/icon.jpg
--   access:  group members read, admin write
--
-- Bucket: step-photos
--   path:    step-photos/{note_id}/{step_id}/{photo_id}.jpg
--   access:  group members read (published), editor/admin write
--
-- All buckets: NOT public. Signed URLs are used for client access.
-- ============================================================
