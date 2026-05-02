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
    const { imageBase64, mimeType, context } = await req.json() as {
      imageBase64: string;
      mimeType: string;
      context?: string;
    };

    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'imageBase64 and mimeType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contextText = context ? `\nこれは「${context}」という手順書のステップです。` : '';
    const prompt = `あなたは家事の専門家です。この写真に写っている作業内容を分析し、家事手順書のステップの説明文を日本語で1〜2文で生成してください。${contextText}

要件:
- 作業の具体的な動作を説明すること
- 初心者にもわかりやすい表現を使うこと
- 説明文のみを返すこと（JSON不要）`;

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.5, maxOutputTokens: 256 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${await response.text()}`);
    }

    const data = await response.json();
    const description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
