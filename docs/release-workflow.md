# リリース・開発フロー — kaji-note

## ブランチ戦略

```
main          ──●──────────────────●──────────────→  App Store / Google Play
                 ↑ PR merge                ↑ PR merge (hotfix)
develop       ──●──●──●──●──────────────────────→  TestFlight Internal / Google Play Internal
                     ↑ PR merge
feature/*     ──────●──→（完了後 develop へ PR）
hotfix/*      ────────────────────●──→（develop と main 両方へ PR）
```

### ブランチ一覧

| ブランチ | 用途 | 保護設定 |
|----------|------|---------|
| `main` | 本番リリース済みコード | 直接 push 禁止・PR + レビュー必須 |
| `develop` | 次バージョンの統合ブランチ | 直接 push 禁止・PR 必須 |
| `feature/<issue番号>-<短い説明>` | 機能開発・バグ修正 | なし |
| `hotfix/<issue番号>-<短い説明>` | 本番緊急修正 | なし |

### ブランチ命名例

```
feature/42-step-drag-and-drop
feature/57-ai-step-generation
hotfix/88-crash-on-ios17
```

---

## バージョン管理

### バージョン番号体系

```
MAJOR.MINOR.PATCH
  1   . 2   . 3
```

| セグメント | 変更タイミング |
|-----------|--------------|
| MAJOR | 互換性を破壊する変更（DB マイグレーション必須など）|
| MINOR | 新機能追加（後方互換あり）|
| PATCH | バグ修正・軽微な改善 |

初回リリースは `1.0.0`。

### ビルド番号の管理

- iOS `buildNumber` / Android `versionCode` は **EAS が自動採番**（remote auto-increment）
- `app.json` の `version` のみ手動で管理する

```jsonc
// app.json 抜粋
{
  "expo": {
    "version": "1.0.0",
    "ios": {
      "buildNumber": "1"    // EAS が上書きするため実質的に使われない
    },
    "android": {
      "versionCode": 1      // 同上
    }
  }
}
```

---

## EAS Build プロファイル

`eas.json` で 3 つのプロファイルを定義する。

| プロファイル | 用途 | 配布方法 | OTA チャンネル |
|------------|------|---------|--------------|
| `development` | ローカル開発・Expo Dev Client | 内部（シミュレーター含む）| — |
| `preview` | QA・TestFlight Internal | 内部配布 | `preview` |
| `production` | App Store / Google Play 審査・公開 | ストア | `production` |

---

## OTA アップデート（EAS Update）

Expo EAS Update を使い、審査なしで JS バンドルのみを更新できる。

| チャンネル | 対象ビルドプロファイル | 更新トリガー |
|-----------|---------------------|------------|
| `preview` | preview ビルド | `develop` への push 時に自動 |
| `production` | production ビルド | `main` への push 時に自動 |

**OTA で配布できる変更**: JS コード・アセット（画像・フォント）  
**OTA で配布できない変更**: ネイティブコード変更（新 Expo モジュール追加など）→ 再ビルドが必要

---

## CI/CD パイプライン（GitHub Actions）

### ワークフロー一覧

| ファイル | トリガー | 内容 |
|---------|---------|------|
| `pr-check.yml` | PR 作成・更新（`develop`, `main` 向け）| lint / typecheck / test |
| `build-preview.yml` | `develop` へのマージ | preview ビルド + TestFlight Internal 配信 + OTA update |
| `build-production.yml` | `main` へのマージ | production ビルド + App Store Connect 提出 + Google Play Internal 提出 |

### シークレット設定（GitHub Repository Secrets）

| シークレット名 | 値 |
|-------------|---|
| `EXPO_TOKEN` | EAS CLI 認証トークン（`eas whoami` で確認） |
| `APPLE_ID` | Apple Developer アカウントのメールアドレス |
| `ASC_APP_ID` | App Store Connect の App ID（数字） |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google Play API サービスアカウント JSON（base64 エンコード） |

---

## 開発フロー（日常作業）

### 1. 機能開発

```bash
# develop から最新を取得してブランチ作成
git checkout develop
git pull origin develop
git checkout -b feature/42-step-drag-and-drop

# 作業・コミット
git add -p
git commit -m "feat: ステップのドラッグ&ドロップ並び替えを実装"

# develop へ PR 作成
git push -u origin feature/42-step-drag-and-drop
# → GitHub で PR を作成し、CI パス後にマージ
```

### 2. コミットメッセージ規約（Conventional Commits）

```
<type>(<scope>): <概要（日本語可）>

type:
  feat     新機能
  fix      バグ修正
  docs     ドキュメントのみの変更
  style    フォーマット変更（ロジック変更なし）
  refactor リファクタリング
  test     テスト追加・修正
  chore    ビルド・ツール設定の変更
  perf     パフォーマンス改善
```

例:
```
feat(step): ドラッグ&ドロップ並び替えを実装
fix(auth): Googleログイン後にリダイレクトされない問題を修正
docs: eas.json のプロファイル説明を追記
```

### 3. リリース手順（develop → main）

```bash
# 1. develop が安定したことを確認（CI グリーン・QA 完了）
# 2. バージョンを bump
git checkout develop
# app.json の version を更新（例: 1.0.0 → 1.1.0）

git add app.json
git commit -m "chore: bump version to 1.1.0"
git push origin develop

# 3. main への PR を作成（タイトル例: "Release v1.1.0"）
# 4. PR マージ → CI が自動でビルド + App Store Connect 提出
# 5. App Store Connect で審査を手動提出
```

### 4. 緊急修正（Hotfix）

```bash
# main から hotfix ブランチを作成
git checkout main
git pull origin main
git checkout -b hotfix/88-crash-on-ios17

# 修正・コミット
git commit -m "fix(ios): iOS 17 でクラッシュする問題を修正"

# main と develop の両方へ PR を作成
git push -u origin hotfix/88-crash-on-ios17
```

---

## TestFlight 配信フロー

```
develop へマージ
  └─ GitHub Actions: preview ビルド
       └─ EAS Build: IPA 生成
            └─ EAS Submit: TestFlight Internal に自動アップロード
                 └─ TestFlight: 内部テスター（開発チーム）に即時配信
                      └─ 問題なければ External Group へ手動追加（任意）
```

**TestFlight で確認すべき項目**:
- [ ] 認証（メール・Google OAuth）
- [ ] カメラ・写真アクセス権限
- [ ] Push 通知（将来実装時）
- [ ] クラッシュ有無（Crashlytics または Expo Diagnostics で確認）

---

## App Store / Google Play リリースチェックリスト

本番リリース前に確認する:

### 共通
- [ ] `app.json` の `version` を更新した
- [ ] CHANGELOG（または GitHub Releases）に変更内容を記載した
- [ ] TestFlight / Google Play Internal で動作確認済み
- [ ] Supabase Edge Functions の環境変数（本番用 Gemini API キーなど）が正しい

### iOS (App Store)
- [ ] App Store Connect でスクリーンショット（6.7" / 6.5" / 5.5"）を更新した
- [ ] 新機能のプライバシー情報（NSUsageDescription）を追加した
- [ ] App Store Connect の「審査への提出」を手動でクリックした

### Android (Google Play)
- [ ] Google Play Console でリリースノートを入力した
- [ ] `aab` ファイルが正常に生成されているか確認した
- [ ] Internal Track → Production Track へのロールアウト率を設定した（初回は 20% 推奨）

---

## ローカル開発セットアップ

```bash
# 依存インストール
npm install

# Expo Dev Client ビルド（初回のみ・実機またはシミュレーター）
eas build --profile development --platform ios
eas build --profile development --platform android

# 開発サーバー起動（ビルド済み Dev Client と接続）
npx expo start --dev-client

# TypeScript 型チェック
npx tsc --noEmit

# Lint
npm run lint

# テスト
npm test
```
