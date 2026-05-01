# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**kaji-note** は、家事の手順を写真付きで家族・チームメンバー間で共有するスマートフォン向けアプリです。

主な機能:
- 家事タスクのステップバイステップ手順作成（テキスト＋写真）
- 手順書の共有・閲覧
- スマートフォンのカメラから直接写真を撮影・添付

## Tech Stack

### モバイルアプリ: React Native (Expo)

| 用途 | パッケージ |
|------|-----------|
| 開発基盤 | Expo SDK 51+ |
| 画面遷移 | Expo Router |
| カメラ/写真選択 | expo-image-picker |
| 写真圧縮 | expo-image-manipulator |
| 音声入力（STT） | react-native-voice (iOS: SFSpeechRecognizer / Android: SpeechRecognizer) |
| ドラッグ&ドロップ | react-native-reanimated + react-native-gesture-handler |
| オフラインキャッシュ | react-native-mmkv |
| UI スタイル | NativeWind (Tailwind for React Native) |

### バックエンド: Supabase（無料枠運用）

| 機能 | サービス |
|------|---------|
| 認証 | Supabase Auth（メール + Google OAuth） |
| データ | PostgreSQL + Row Level Security |
| 写真保存 | Supabase Storage |
| AI API 中継 / 共有リンク | Supabase Edge Functions（API キー保護のため端末から直接呼ばない） |

**Edge Functions 一覧:**

| 関数名 | 用途 |
|--------|------|
| `generate_steps` | UC-07-1: タイトル → ステップ自動生成 |
| `suggest_next_step` | UC-07-2: 次ステップ提案 |
| `describe_photo` | UC-07-3: 写真 → ステップ説明文生成 |
| `format_voice_text` | UC-07-4: 音声テキスト整形 |
| `get_note_by_share_token` | UC-05-2: 未認証ユーザーへの閲覧専用リンクアクセス（service_role でトークン検証） |

無料枠: DB 500MB / Storage 1GB / MAU 50,000。上限超過時は自動課金されず手動アップグレードが必要。

### 状態管理

| 役割 | ライブラリ |
|------|-----------|
| サーバー状態・オフライン同期 | TanStack Query + @tanstack/query-async-storage-persister |
| UI 状態（実行モード進捗など） | Zustand |

### AI 機能: Google Gemini API（無料枠運用）

| ユースケース | モデル |
|------------|-------|
| UC-07-1 タイトルからステップ生成 | Gemini 1.5 Flash |
| UC-07-2 次ステップ提案 | Gemini 1.5 Flash |
| UC-07-3 写真からステップ説明文生成 | Gemini 1.5 Flash (Vision) |
| UC-07-4 音声テキスト整形 | Gemini 1.5 Flash |

無料枠: 1,500 リクエスト/日。Google Cloud Console で予算アラートを $0 に設定し、課金を有効化しないことで無料枠超過後もリクエストエラーになるだけで自動課金されない。

Gemini API の呼び出しは Supabase Edge Functions 経由で行い、API キーをクライアントに露出させない。

## Development Commands

*(セットアップ後に記載)*

```bash
# 例: Expo を使う場合
npx expo start          # 開発サーバー起動
npx expo start --ios    # iOS シミュレーター
npx expo start --android # Android エミュレーター
npm test                # テスト実行
npm run lint            # lint
```

## Architecture Notes

設計書は `docs/` ディレクトリを参照:

| ファイル | 内容 |
|----------|------|
| `docs/usecases.md` | ユースケース一覧・優先度マトリクス |
| `docs/features.md` | 機能定義（バリデーション・権限・オフライン挙動など） |
| `docs/screen-design.md` | 画面設計・ワイヤーフレーム・画面遷移図 |
| `docs/database-schema.md` | ER 図・テーブル仕様・RLS 設計方針 |
| `supabase/migrations/` | 実際の SQL マイグレーション |

実装開始後に追記してください:
- ディレクトリ構成と各層の責務
- 写真アップロードのフロー（圧縮 → AI 説明文生成 → Storage → DB）

## Key Constraints

- **スマートフォン優先**: UI/UX はモバイル画面（375px〜）を基準に設計する
- **オフライン考慮**: 手順の閲覧・実行モードのステップ進捗はオフラインでも動作させる。ただし「実施済み」記録・編集・写真アップロードはオンライン必須
- **写真容量**: アップロード前に長辺 1280px・JPEG 品質 80・500KB 以下に圧縮する（`expo-image-manipulator` 使用）
- **グループ上限**: メンバー上限 20 名は DB 制約ではなくアプリ層で施行する（参加処理前に件数チェック）
- **AI API はクライアントから直接呼ばない**: Gemini API キーを端末に持たせない。必ず Supabase Edge Functions 経由
- **論理削除**: 手順書の削除は `soft_delete_note()` RPC を必ず経由する（`deleted_at` を直接 UPDATE しない）
- **実施記録は不変ログ**: `executions` テーブルへの UPDATE / DELETE は RLS で禁止されている
