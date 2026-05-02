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
    const { title, existingSteps } = await req.json() as {
      title: string;
      existingSteps: string[];
    };

    if (!title || !existingSteps) {
      return new Response(JSON.stringify({ error: 'title and existingSteps are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stepsText = existingSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');

    const prompt = `あなたは家事の専門家です。以下の「${title}」の手順書の続きとなる次のステップを3つ提案してください。

現在のステップ:
${stepsText}

要件:
- 上記のステップの自然な続きになること
- 各候補は1〜2文の簡潔な説明にすること
- 日本語で書くこと
- JSON配列形式で3つの候補を返すこと

候補のみを含むJSON配列を返してください。`;

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${await response.text()}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const suggestions: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
