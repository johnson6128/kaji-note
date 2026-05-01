# kaji-note

家事手順を写真付きで共有するスマートフォン向けアプリ。

## 必要なもの

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [EAS CLI](https://docs.expo.dev/eas/) （ビルド・デプロイ時のみ）

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を開き、[Supabase Dashboard](https://supabase.com/dashboard) > プロジェクト > Settings > API から値を取得して入力する。

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Edge Functions のシークレット設定

**ローカル開発用：**

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

`supabase/functions/.env` に [Google AI Studio](https://aistudio.google.com/) で取得した Gemini API キーを入力する。

```
GEMINI_API_KEY=AIzaSy...
```

**本番環境（Supabase にデプロイ後）：**

```bash
supabase secrets set GEMINI_API_KEY=AIzaSy...
```

> **注意:** `GEMINI_API_KEY` はクライアントアプリには渡さない。Supabase Edge Functions 経由でのみ使用する。

### 4. 開発サーバーの起動

```bash
npx expo start           # Expo Go で確認
npx expo start --ios     # iOS シミュレーター
npx expo start --android # Android エミュレーター
```

## 環境変数一覧

| 変数名 | 説明 | 設定場所 |
|--------|------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | `.env.local` / EAS Secret |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon キー（公開可） | `.env.local` / EAS Secret |
| `EAS_PROJECT_ID` | EAS プロジェクト ID | `.env.local` / EAS 自動挿入 |
| `GEMINI_API_KEY` | Gemini API キー（**非公開**） | `supabase/functions/.env` / Supabase Secret のみ |

## EAS Build（CI/CD）

```bash
# 開発ビルド（実機テスト用）
eas build --profile development --platform ios

# プレビュービルド（社内配布）
eas build --profile preview --platform all

# 本番ビルド
eas build --profile production --platform all
```

EAS のシークレットは `eas secret:create` またはダッシュボードから登録する。

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://...
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJh...
```
