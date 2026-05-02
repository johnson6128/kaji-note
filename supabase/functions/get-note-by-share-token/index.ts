import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: shareLink, error: linkError } = await supabase
      .from('share_links')
      .select('note_id, invalidated_at')
      .eq('token', token)
      .is('invalidated_at', null)
      .single();

    if (linkError || !shareLink) {
      return new Response(JSON.stringify({ error: 'invalid_or_expired_token' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*, steps(*, step_photos(*))')
      .eq('id', shareLink.note_id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .single();

    if (noteError || !note) {
      return new Response(JSON.stringify({ error: 'note_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    note.steps = (note.steps ?? []).sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position,
    );
    note.steps.forEach((s: { step_photos: { position: number }[] }) => {
      s.step_photos = (s.step_photos ?? []).sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position,
      );
    });

    return new Response(JSON.stringify({ note }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
