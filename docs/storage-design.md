# ストレージ設計 — kaji-note

Supabase Storage（非公開バケット）を使った写真・アイコン管理の設計書。  
実装は `supabase/migrations/20260501000001_storage_setup.sql` にある。

---

## バケット一覧

| バケット ID | 用途 | 公開 | 上限サイズ | 許可 MIME |
|-------------|------|:----:|-----------|-----------|
| `avatars` | ユーザーアバター | × | 2 MB | JPEG / PNG / WebP |
| `group-icons` | グループアイコン | × | 2 MB | JPEG / PNG / WebP |
| `step-photos` | 手順書ステップ写真 | × | 5 MB | JPEG / WebP |

すべて **非公開**。クライアントへの画像配信は **署名付き URL**（Signed URL）を使う。  
`step-photos` の上限 5 MB はクライアント側圧縮後の安全マージン。実際には 200 KB 前後を目標にする。

---

## パス命名規則

### 格納値の形式

DB 列（`storage_path` / `avatar_url` / `icon_url`）には以下の形式でフルパスを保存する。

```
{bucket_id}/{object_key}
```

`storage.objects.name` には `{object_key}` のみが格納される（バケット名を含まない）。

### 各バケットのオブジェクトキー

| バケット | DB 列 | オブジェクトキー | DB 格納値の例 |
|----------|-------|----------------|--------------|
| `avatars` | `profiles.avatar_url` | `{user_id}/avatar.jpg` | `avatars/550e8400-…/avatar.jpg` |
| `group-icons` | `groups.icon_url` | `{group_id}/icon.jpg` | `group-icons/f47ac10b-…/icon.jpg` |
| `step-photos` | `step_photos.storage_path` | `{note_id}/{step_id}/{photo_id}.jpg` | `step-photos/a1b2…/c3d4…/e5f6….jpg` |

`{photo_id}` は `step_photos.id`（UUID）。

### 設計の意図

- **`avatars` / `group-icons`** は 1 エンティティ 1 ファイル。同じパスへ上書きすることでバケット内に孤立オブジェクトが蓄積しない。
- **`step-photos`** は `{note_id}` を第 1 セグメントに置く。Storage RLS ポリシーがパスの先頭から `note_id` を取得してノートの権限チェックを行うため、この順序が必須。
- 写真の「差し替え」は **削除 + 再アップロード** で行う（UPDATE ポリシーなし）。削除前に `step_photos` レコードを DB から消し、新しい UUID でアップロード → 新レコード INSERT の順に行う。

---

## クライアント実装ガイド

### アップロード

```ts
// 1. UUID を生成してオブジェクトキーを組み立てる
const photoId   = crypto.randomUUID();
const objectKey = `${noteId}/${stepId}/${photoId}.jpg`;

// 2. 圧縮（expo-image-manipulator で 1280px / quality 0.8 目安）

// 3. アップロード
const { error } = await supabase.storage
  .from('step-photos')
  .upload(objectKey, compressedFile, { contentType: 'image/jpeg' });

// 4. DB に保存（フルパスを格納）
await supabase.from('step_photos').insert({
  step_id:      stepId,
  storage_path: `step-photos/${objectKey}`,
  position:     1,
});
```

### 署名付き URL の取得

```ts
// DB から storage_path を読み出し、バケットとオブジェクトキーを分離
const [bucket, ...rest] = storagePath.split('/');
const objectKey = rest.join('/');

const { data } = await supabase.storage
  .from(bucket)
  .createSignedUrl(objectKey, 60 * 60); // 1 時間有効

// data.signedUrl を <Image> の source に渡す
```

### 写真の差し替え

```ts
// 1. 旧オブジェクトをストレージから削除
await supabase.storage
  .from('step-photos')
  .remove([oldObjectKey]);

// 2. 旧 step_photos レコードを DB から削除
await supabase.from('step_photos').delete().eq('id', oldPhotoId);

// 3. 新しい UUID で再アップロード → INSERT（上記と同じ）
```

---

## RLS ポリシー一覧

### `avatars` バケット

| 操作 | ロール | 条件 |
|------|--------|------|
| SELECT | authenticated | 制限なし（プロフィールは全員閲覧可） |
| INSERT | authenticated | パス第 1 セグメント = `auth.uid()` |
| UPDATE | authenticated | パス第 1 セグメント = `auth.uid()` |
| DELETE | authenticated | パス第 1 セグメント = `auth.uid()` |

### `group-icons` バケット

| 操作 | ロール | 条件 |
|------|--------|------|
| SELECT | authenticated | `is_group_member(group_id)` |
| INSERT | authenticated | `is_group_admin(group_id)` |
| UPDATE | authenticated | `is_group_admin(group_id)` |
| DELETE | authenticated | `is_group_admin(group_id)` |

`group_id` はパス第 1 セグメント（`storage.foldername(name)[1]::uuid`）から取得。

### `step-photos` バケット

| 操作 | ロール | 条件 |
|------|--------|------|
| SELECT | authenticated | published ノートのグループメンバー、または draft ノートの作成者本人 |
| INSERT | authenticated | `can_edit_in_group(note.group_id)`（admin / editor） |
| UPDATE | — | ポリシーなし（削除 + 再アップロードで代替） |
| DELETE | authenticated | `can_edit_in_group(note.group_id)` |

`note_id` はパス第 1 セグメント（`storage.foldername(name)[1]::uuid`）から取得し、`notes` テーブルを参照して権限チェックを行う。

---

## 容量見積もり（無料枠 1 GB）

| 種別 | 平均サイズ | 本数 / ユニット | 想定 |
|------|-----------|----------------|------|
| アバター | 200 KB | 1 / ユーザー | 50 ユーザー → 10 MB |
| グループアイコン | 200 KB | 1 / グループ | 20 グループ → 4 MB |
| ステップ写真 | 200 KB | 最大 3 / ステップ | 残り ~986 MB ≒ 4,930 枚 |

写真 1 枚 200 KB は圧縮後の目安値（1280px 短辺、JPEG quality 0.8）。  
1 GB の上限に近づいたら Supabase ダッシュボードの Storage > Overview で使用量を確認する。

---

## 孤立オブジェクトの扱い

Supabase Storage のオブジェクトは DB の CASCADE では自動削除されない。  
以下のケースで孤立が発生しうる：

| ケース | 対処方法 |
|--------|---------|
| ノートを論理削除 | 孤立したまま（Storage は削除しない）。将来的に Edge Function の定期クリーンアップで対応する想定。 |
| ステップを削除 | アプリ側で `step_photos` レコード削除前後にストレージオブジェクトも削除する。 |
| 写真を差し替え | 上記「差し替え」手順に従い旧オブジェクトを明示的に削除する。 |

論理削除されたノートの写真はビューアからアクセスできない（Storage RLS で `notes.deleted_at IS NULL` を必須条件にしているため）。実際のバイト数は解放されないが、誤閲覧は防げる。
