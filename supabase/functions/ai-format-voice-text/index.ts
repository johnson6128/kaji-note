import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { rawText, context } = await req.json() as {
      rawText: string;
      context?: string;
    };

    if (!rawText) {
      return new Response(JSON.stringify({ error: 'rawText is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contextText = context ? `これは「${context}」という家事の手順書のステップです。` : '';
    const prompt = `あなたは家事の専門家です。以下の音声認識テキストを、家事手順書のステップとして適切な説明文に整形してください。${contextText}

音声テキスト: 「${rawText}」

要件:
- 自然で読みやすい日本語に整形すること
- 手順を示す文体にすること（例:「〜する」「〜を〜する」）
- 1〜2文にまとめること
- 整形後のテキストのみを返すこと`;

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${await response.text()}`);
    }

    const data = await response.json();
    const formattedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? rawText;

    return new Response(JSON.stringify({ formattedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
