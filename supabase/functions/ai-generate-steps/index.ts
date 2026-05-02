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
    const { title } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: 'title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `あなたは家事の専門家です。「${title}」という家事の手順を、初心者にもわかりやすく、具体的なステップに分けて提案してください。

要件:
- 5〜10ステップで記述すること
- 各ステップは1〜2文の簡潔な説明にすること
- 日本語で書くこと
- JSON配列形式で返すこと（各要素は文字列）

例: ["道具を準備する（雑巾、バケツ、洗剤）", "バケツにぬるま湯と洗剤を入れる", ...]

ステップのみを含むJSON配列を返してください。余計なテキストは不要です。`;

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const steps: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ steps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
