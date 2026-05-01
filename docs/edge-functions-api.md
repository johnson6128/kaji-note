# Edge Functions API 設計 — kaji-note

Supabase Edge Functions を経由した Gemini API 中継の入出力インターフェース定義。  
クライアントは `supabase.functions.invoke('<name>', { body })` で呼び出す。

---

## 共通仕様

### 認証

全エンドポイントで Supabase Auth の JWT が必要。  
`supabase.functions.invoke` は `Authorization: Bearer <jwt>` を自動付与する。

### リクエスト / レスポンス形式

- Content-Type: `application/json`（UC-07-3 のみ例外あり、後述）
- 成功時 HTTP 200、失敗時 4xx/5xx

### 共通エラーレスポンス

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "AI機能の1日の利用上限に達しました。明日以降お試しください。"
  }
}
```

| code | HTTP | 説明 |
|------|------|------|
| `UNAUTHORIZED` | 401 | JWT なし・期限切れ |
| `VALIDATION_ERROR` | 400 | 必須フィールド欠落・型不正 |
| `QUOTA_EXCEEDED` | 429 | Gemini API 無料枠 1,500 req/日 超過 |
| `UPSTREAM_ERROR` | 502 | Gemini API からエラーレスポンス |
| `INTERNAL_ERROR` | 500 | その他 |

---

## UC-07-1 タイトルからステップ自動生成

**Function name**: `ai-generate-steps`

### リクエスト

```json
{
  "title": "お風呂掃除",
  "category": "cleaning"
}
```

| フィールド | 型 | 必須 | 制約 |
|-----------|-----|------|------|
| `title` | string | ✓ | 1〜50文字 |
| `category` | string | — | `cleaning` / `cooking` / `laundry` / `storage` / `other` |

### レスポンス

```json
{
  "steps": [
    { "position": 1, "body": "換気扇を回し、窓を開けて換気する" },
    { "position": 2, "body": "洗剤をスプレーして5分置く" },
    { "position": 3, "body": "スポンジでバスタブ・壁面を円を描くようにこする" },
    { "position": 4, "body": "シャワーで洗剤を十分に流す" },
    { "position": 5, "body": "水気をスクイージーで切り、乾拭きする" }
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `steps` | array | 生成されたステップ一覧（最大 10 件）|
| `steps[].position` | number | 1 始まりの連番 |
| `steps[].body` | string | ステップ説明文（500文字以内） |

---

## UC-07-2 入力中のステップから次ステップを提案

**Function name**: `ai-suggest-next-step`

### リクエスト

```json
{
  "title": "お風呂掃除",
  "steps": [
    { "position": 1, "body": "換気扇を回す" },
    { "position": 2, "body": "洗剤をスプレーして5分置く" }
  ]
}
```

| フィールド | 型 | 必須 | 制約 |
|-----------|-----|------|------|
| `title` | string | ✓ | 1〜50文字 |
| `steps` | array | ✓ | 1〜30件。`position`・`body` を含む |

### レスポンス

```json
{
  "suggestions": [
    "スポンジでバスタブの側面を円を描くようにこする",
    "鏡や蛇口周りの水垢もクリーナーで磨く"
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `suggestions` | string[] | 次ステップ候補（2〜3件）。ユーザーが選択してそのまま `body` に使う |

---

## UC-07-3 写真からステップ説明文を自動生成

**Function name**: `ai-describe-photo`

写真データを JSON の `image_base64` フィールドで送信する。  
端末側で圧縮済み（800px 以内・JPEG 品質 70）の画像を想定。base64 サイズは 300KB 以内を推奨。

### リクエスト

```json
{
  "image_base64": "/9j/4AAQSkZJRgAB...",
  "mime_type": "image/jpeg",
  "title": "お風呂掃除"
}
```

| フィールド | 型 | 必須 | 制約 |
|-----------|-----|------|------|
| `image_base64` | string | ✓ | base64 エンコード済み画像。400KB 以内（元画像を端末で圧縮してから送る） |
| `mime_type` | string | ✓ | `image/jpeg` / `image/png` |
| `title` | string | — | 手順書タイトル（Gemini へのコンテキストとして使用） |

### レスポンス

```json
{
  "body": "スポンジに洗剤をつけてバスタブの側面を円を描くようにこする"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `body` | string | 写真から生成したステップ説明文（500文字以内）。そのまま `steps.body` に使える |

---

## UC-07-4 音声テキストの整形

**Function name**: `ai-format-voice-text`

端末の音声認識 API（iOS: SFSpeechRecognizer / Android: SpeechRecognizer）が出力した  
生テキストを受け取り、手順文として自然な日本語に整形する。

### リクエスト

```json
{
  "raw_text": "えーとスポンジに洗剤つけてバスタブをゴシゴシしてでそれから水で流す",
  "title": "お風呂掃除"
}
```

| フィールド | 型 | 必須 | 制約 |
|-----------|-----|------|------|
| `raw_text` | string | ✓ | 音声認識の生テキスト（1〜500文字） |
| `title` | string | — | 手順書タイトル（コンテキスト補助） |

### レスポンス

```json
{
  "body": "スポンジに洗剤をつけてバスタブをこすり、シャワーで十分に洗い流す"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `body` | string | 整形済みステップ説明文（500文字以内）。ユーザーが確認・編集してから保存する |

---

## クライアント実装メモ

```typescript
// UC-07-1 の呼び出し例
const { data, error } = await supabase.functions.invoke('ai-generate-steps', {
  body: { title: noteTitle, category: noteCategory },
});

if (error) {
  // error.message に上記 error.message が入る
  // QUOTA_EXCEEDED → ユーザーへのトースト表示
}
// data.steps をそのまま steps 配列に追加
```

### 注意点

- **課金抑制**: UC-07-1・07-2・07-4 はボタンタップ時のみ呼び出す（入力変化で自動発火しない）
- **タイムアウト**: Supabase Edge Functions のデフォルトタイムアウトは 150 秒。Gemini Flash は通常 2〜5 秒で応答するため問題ないが、クライアント側に 30 秒のタイムアウトを設ける
- **リトライ**: `QUOTA_EXCEEDED` はリトライ不可。`UPSTREAM_ERROR` / `INTERNAL_ERROR` は 1 回のみリトライ（指数バックオフ不要）
- **写真サイズ**: UC-07-3 で送る前に `expo-image-manipulator` で 800px・品質 70 に圧縮する。base64 後 400KB を超える場合は品質をさらに下げる
