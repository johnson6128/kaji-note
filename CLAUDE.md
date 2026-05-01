# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**kaji-note** は、家事の手順を写真付きで家族・チームメンバー間で共有するスマートフォン向けアプリです。

主な機能:
- 家事タスクのステップバイステップ手順作成（テキスト＋写真）
- 手順書の共有・閲覧
- スマートフォンのカメラから直接写真を撮影・添付

## Tech Stack

*(未定。プロジェクト初期のため、以下の選択肢から決定予定)*

**推奨候補:**
- **モバイルアプリ**: React Native (Expo) — カメラ・写真ライブラリへのアクセスが容易
- **バックエンド/DB**: Supabase (PostgreSQL + Storage + Auth) — 写真ストレージと認証をまとめて管理できる
- **状態管理**: Zustand or TanStack Query

技術スタックが確定したら、このセクションを更新してください。

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

*(実装開始後に記載)*

プロジェクトが育ったら以下を記録してください:
- ディレクトリ構成と各層の責務
- 写真アップロードのフロー（端末 → ストレージ → DB への参照保存）
- 認証・共有の仕組み（招待リンク、グループ管理など）

## Key Constraints

- **スマートフォン優先**: UI/UX はモバイル画面（375px〜）を基準に設計する
- **オフライン考慮**: 手順の閲覧は可能な限りオフラインでも動作させる
- **写真容量**: アップロード前にリサイズ・圧縮して通信コストを抑える
