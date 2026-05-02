-- Fix: add SET search_path = public to SECURITY DEFINER functions
-- Supabase requires this to avoid "Database error saving new user"

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    LEFT(
      COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        split_part(NEW.email, '@', 1)
      ),
      30
    )
  );
  RETURN NEW;
END;
$$;
