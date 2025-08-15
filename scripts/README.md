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

### 1. Asset Migration Tool (`contentful-assets-to-strapi.ts`) ⭐ NEW

Contentful からエクスポートしたアセット（画像、動画、PDF等）のみを Strapi に移行する専用ツールです。

#### 実行コマンド

```bash
# 全アセットを移行
pnpm run migrate:assets

# ドライラン（実際のアップロードは行わない）
pnpm run migrate:assets:dry

# 画像のみ移行
pnpm run migrate:assets:images

# 動画のみ移行
pnpm run migrate:assets:videos

# PDF・ドキュメントのみ移行
pnpm run migrate:assets:documents

# カスタムオプション付き実行
ts-node scripts/contentful-assets-to-strapi.ts --type=images --parallel=5 --retries=3 --dry-run
```

#### 機能

- **ファイルタイプフィルタリング**: 画像、動画、ドキュメント別に移行可能
- **並列アップロード**: 最大5ファイル同時処理（設定可能）
- **リトライ機能**: 失敗したファイルの自動再試行
- **メタデータ保持**: タイトル、説明、代替テキストを保持
- **詳細な統計情報**: 成功率、ファイルタイプ別結果
- **出力ファイル**:
  - `asset-mapping-{timestamp}.json`: Contentful ID → Strapi ID マッピング
  - `failed-assets-{timestamp}.json`: 失敗したアセットのリスト
  - `asset-migration-log-{timestamp}.json`: 詳細ログ

#### オプション

- `--type=images|videos|documents|all`: 移行するファイルタイプ
- `--parallel=N`: 同時並列処理数（デフォルト: 3）
- `--retries=N`: リトライ回数（デフォルト: 2）
- `--dry-run`: ドライラン実行

### 2. Mapping Template Generator (`generate-mapping-template.ts`)

Contentful のエクスポートデータから、Content Type とフィールドのマッピングテンプレートを自動生成します。

#### 実行コマンド

```bash
pnpm run generate-mapping
```

#### 使用方法

1. テンプレート生成後、`content-mapping-template.ts` ファイルが作成されます
2. ファイル内の `strapiId` を実際の Strapi での命名に合わせて修正
3. フィールドマッピングも必要に応じて調整
4. `content-mapping.ts` を置き換える

### 2. Analysis Script (`analyze-contentful-export.ts`)

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

### 2. Content & Entry Migration Script (`contentful-to-strapi.ts`)

Contentful のコンテンツタイプとエントリデータを Strapi にインポートします。

#### 実行コマンド

```bash
# コンテンツとエントリの移行を実行
pnpm run migrate:content

# ドライラン（実際の操作は行わず、ログのみ出力）
pnpm run migrate:content:dry
```

#### 処理内容

1. **アセットマッピング読み込み**: 事前に実行したアセット移行の結果を参照
2. **コンテンツタイプ作成**: Contentful のコンテンツタイプを Strapi のスキーマに変換
3. **エントリ移行**: すべてのエントリデータを Strapi に移行（アセット参照を解決）

#### 注意事項

このスクリプトを実行する前に、必ずアセット移行を完了させてください：
```bash
# 1. まずアセットを移行
pnpm run migrate:assets

# 2. 次にコンテンツとエントリを移行
pnpm run migrate:content
```

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

1. **マッピングテンプレート生成** (初回のみ):
```bash
pnpm run generate-mapping
```

2. **マッピング設定の編集**:
生成された `content-mapping-template.ts` を編集し、`content-mapping.ts` に置き換える

3. **データ解析**:
```bash
pnpm run analyze
```

4. **アセット移行** (2段階移行 - ステップ1):
```bash
# ドライラン
pnpm run migrate:assets:dry

# 実際の移行
pnpm run migrate:assets
```

5. **コンテンツ・エントリ移行** (2段階移行 - ステップ2):
```bash
# ドライラン
pnpm run migrate:content:dry

# 実際の移行
pnpm run migrate:content
```

6. **結果の検証**:
```bash
pnpm run validate
```

### 🔄 2段階移行のメリット

- **独立実行**: アセットとコンテンツを別々に移行可能
- **エラー分離**: 問題が発生した場合、影響範囲を特定しやすい
- **再実行容易**: 失敗した部分のみ再実行可能
- **並列処理**: アセット移行は並列処理で高速化

### 設定オプション

#### DRY_RUN モード
`.env` ファイルで `DRY_RUN=true` に設定すると、実際の操作を行わずログのみ出力します。

#### ログファイル
マイグレーション実行時に `migration-log-{timestamp}.json` ファイルが作成され、詳細なログが保存されます。

## Content Type とフィールドのマッピング

### マッピング設定ファイル (`content-mapping.ts`)

Contentful と Strapi で Content Type 名やフィールド名が異なる場合のマッピング設定ファイルです。

#### 設定例

```typescript
export const CONTENT_TYPE_MAPPINGS: ContentTypeMapping[] = [
  {
    contentfulId: 'blogPost',           // Contentful での ID
    strapiId: 'blog-post',              // Strapi での ID
    displayName: 'Blog Post',
    fieldMappings: [
      { contentfulField: 'title', strapiField: 'title' },
      { contentfulField: 'bodyText', strapiField: 'content' },
      { contentfulField: 'publishDate', strapiField: 'publishedAt' },
      { 
        contentfulField: 'tags', 
        strapiField: 'tags',
        skipMigration: true  // このフィールドは移行しない
      },
      { 
        contentfulField: 'status', 
        strapiField: 'status',
        customTransform: (value) => value.toLowerCase()  // カスタム変換
      }
    ]
  }
];
```

#### フィールドオプション

- `skipMigration`: `true` にすると、そのフィールドは移行されません
- `customTransform`: 値をカスタム変換する関数を指定できます

### マッピングテンプレートの自動生成

1. `pnpm run generate-mapping` でテンプレートを生成
2. 生成された `content-mapping-template.ts` を編集
3. `content-mapping.ts` に名前を変更

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