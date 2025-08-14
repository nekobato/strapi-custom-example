# Contentful to Strapi Migration Scripts

Contentful からエクスポートしたデータを Strapi にインポートするためのスクリプト集です。

## セットアップ

1. 依存関係のインストール:
```bash
pnpm install
```

2. 環境変数の設定:
`.env` ファイルを作成し、以下の項目を設定してください：

```env
STRAPI_URL=http://localhost:1337
STRAPI_TOKEN=your-strapi-api-token-here
DRY_RUN=false
```

### Strapi API Token の取得方法

1. Strapi Admin Panel にログイン
2. Settings → API Tokens → Create new API Token
3. Token type を "Full access" に設定
4. 作成されたトークンを `STRAPI_TOKEN` に設定

## スクリプト

### 1. Analysis Script (`analyze-contentful-export.ts`)

Contentful エクスポートファイルの内容を解析し、統計情報を出力します。

#### 実行コマンド

```bash
pnpm run analyze
```

#### 出力内容

- 基本統計（コンテンツタイプ数、エントリ数、アセット数）
- コンテンツタイプ詳細情報
- アセット分析（ファイルタイプ、サイズ、タイトル/説明の有無）
- サンプルデータ表示

### 2. Migration Script (`contentful-to-strapi.ts`)

Contentful のエクスポートデータを Strapi にインポートします。

#### 実行コマンド

```bash
# 実際のマイグレーションを実行
pnpm run migrate

# ドライラン（実際の操作は行わず、ログのみ出力）
pnpm run migrate:dry-run
```

#### 処理内容

1. **アセット移行**: 
   - `backup/images.ctfassets.net/kxe5qiticei6/` - 画像ファイル
   - `backup/videos.ctfassets.net/kxe5qiticei6/` - 動画ファイル  
   - `backup/downloads.ctfassets.net/kxe5qiticei6/` - ダウンロードファイル
   - `backup/assets.ctfassets.net/kxe5qiticei6/` - PDFなどのドキュメント
   - **画像のタイトルと説明も含めて移行**

2. **コンテンツタイプ作成**: Contentful のコンテンツタイプを Strapi のスキーマに変換

3. **エントリ移行**: すべてのエントリデータを Strapi に移行

#### フィールドタイプのマッピング

| Contentful | Strapi |
|------------|--------|
| Symbol | string |
| Text | text |
| RichText | richtext |
| Integer | integer |
| Number | decimal |
| Date | datetime |
| Boolean | boolean |
| Link (Asset) | media |
| Link (Entry) | relation |
| Location, Object, Array | json |

### 2. Validation Script (`validate-migration.ts`)

マイグレーション結果を検証し、成功率を確認します。

#### 実行コマンド

```bash
pnpm run validate
```

#### 検証内容

- コンテンツタイプの移行状況
- エントリの移行状況  
- アセットの移行状況
- エラーレポート

## 使用方法

### 基本的な手順

1. **データ解析**:
```bash
pnpm run analyze
```

2. **ドライラン実行**:
```bash
pnpm run migrate:dry-run
```

3. **実際のマイグレーション実行**:
```bash
pnpm run migrate
```

4. **結果の検証**:
```bash
pnpm run validate
```

### 設定オプション

#### DRY_RUN モード
`.env` ファイルで `DRY_RUN=true` に設定すると、実際の操作を行わずログのみ出力します。

#### ログファイル
マイグレーション実行時に `migration-log-{timestamp}.json` ファイルが作成され、詳細なログが保存されます。

## 注意事項

### 事前準備

1. Strapi サーバーが起動していることを確認
2. 適切な API トークンが設定されていることを確認
3. バックアップデータが正しい場所にあることを確認

### 制約事項

- Contentful の Rich Text フィールドは Strapi の richtext 型にマッピングされますが、内容によっては手動調整が必要な場合があります
- エントリ間の関連は Contentful ID をベースに解決されるため、関連先エントリが存在しない場合はリンクが切れる可能性があります
- 大量のアセットがある場合、アップロード処理に時間がかかる場合があります

### トラブルシューティング

#### アセットのアップロードに失敗する場合
- ファイルパスとファイル名を確認
- Strapi のファイルサイズ制限を確認
- ネットワーク接続を確認

#### コンテンツタイプの作成に失敗する場合
- Strapi の Content Type Builder の設定を確認
- 既存のコンテンツタイプとの名前衝突を確認

#### エントリの作成に失敗する場合
- 必須フィールドの値が設定されているか確認
- フィールドタイプの互換性を確認
- 関連フィールドの参照先が存在するか確認

## サポートされるファイル形式

- **画像**: PNG, JPG, JPEG, GIF, SVG, WEBP
- **動画**: MP4, MOV, AVI, WEBM
- **ドキュメント**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- **その他**: ZIP, RAR, TXT, CSV など

## ログレベル

ログ出力は以下のレベルで制御できます：
- `info`: 一般的な進行状況
- `warn`: 警告メッセージ  
- `error`: エラーメッセージ

現在の設定: `LOG_LEVEL=info` (`.env` ファイル)