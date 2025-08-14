# 📋 Lexical Editor Rabo プラグインへの Populate 機能追加計画

## 🎯 目標

Strapi の公式 Rich Text（Blocks）エディタのように、挿入されたメディアやエントリが更新されたときに、Lexical エディタ内の参照も自動的に最新情報に更新される populate 機能を実装する。

## 📚 現状分析

### 既存の実装状況

1. **StrapiImagePlugin**: Media Library の画像を `documentId` と `src` で参照
2. **StrapiEntryPlugin**: Strapi エントリを `documentId` と `contentType` で参照
3. **lexical-search API**: 基本的な検索・取得機能のみ（populate なし）

### 課題

- 現在は参照先の `documentId` のみ保存し、URL や情報は"その時点のスナップショット"
- Media や Entry が更新されても Lexical エディタ内の表示は古いまま
- populate 機能がないため、関連データの最新情報を取得できない

## 🏗️ 実装戦略

### アプローチ: シャドウ参照方式

populate-plugin.md の推奨に従い、以下の戦略を採用：

1. **Lexical JSON は現状維持**（WYSIWYG エディタとしての機能を保持）
2. **隠し relation/media フィールド**を同一コンテンツタイプに追加
3. **コントローラ拡張**で populate → JSON マージを実行

## 📝 実装詳細

### 1. データ構造の拡張

#### Content Type への隠しフィールド追加

```typescript
// schema.json に追加する隠しフィールド
{
  "lexicalContentMedia": {
    "type": "media",
    "multiple": true,
    "allowedTypes": ["images", "files", "videos", "audios"],
    "private": true // 管理画面で非表示
  },
  "lexicalContentEntries": {
    "type": "relation",
    "relation": "oneToMany",
    "target": "api::content.content", // 動的に設定
    "mappedBy": null,
    "private": true
  }
}
```

### 2. プラグインサーバー側の拡張

#### A. コントローラーの拡張

```typescript
// server/src/controllers/lexical-populate.ts
export default {
  async findWithPopulate(ctx) {
    const { documentId } = ctx.params;
    const { contentType } = ctx.query;

    // 基本データ + 隠しリレーションを populate
    const entity = await strapi.documents(contentType).findOne({
      documentId,
      populate: {
        lexicalContentMedia: true,
        lexicalContentEntries: true
      }
    });

    // Lexical JSON 内の参照を最新データでリプレース
    const populatedContent = await populateLexicalReferences(entity);

    ctx.body = populatedContent;
  }
};
```

#### B. 参照解決ユーティリティ

```typescript
// server/src/utils/lexical-populate.ts
async function populateLexicalReferences(entity) {
  const lexicalField = entity.content; // Lexical JSON フィールド

  if (!lexicalField?.root?.children) return entity;

  // 再帰的にノードを走査し、参照を解決
  const populatedNodes = await Promise.all(
    lexicalField.root.children.map((node) => populateNode(node, entity))
  );

  return {
    ...entity,
    content: {
      ...lexicalField,
      root: {
        ...lexicalField.root,
        children: populatedNodes
      }
    }
  };
}

async function populateNode(node, entity) {
  switch (node.type) {
    case "strapi-image":
      return await populateImageNode(node, entity.lexicalContentMedia);
    case "strapi-entry":
      return await populateEntryNode(node, entity.lexicalContentEntries);
    default:
      return node;
  }
}
```

### 3. 管理画面側の拡張

#### A. OnChange Plugin の強化

```typescript
// admin/src/lexical/plugins/StrapiOnChangePlugin.ts
export default function StrapiOnChangePlugin({
  onChange,
  expectedEditorState
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      const serialized = editorState.toJSON();

      // 参照情報を抽出
      const references = extractReferences(serialized);

      // メイン JSON + 参照情報を送信
      onChange({
        content: serialized,
        lexicalContentMedia: references.media,
        lexicalContentEntries: references.entries
      });
    });
  }, [editor, onChange]);
}
```

#### B. 参照抽出ユーティリティ

```typescript
// admin/src/utils/reference-extractor.ts
function extractReferences(editorState) {
  const mediaRefs = [];
  const entryRefs = [];

  function traverseNodes(nodes) {
    nodes.forEach((node) => {
      if (node.type === "strapi-image" && node.documentId) {
        mediaRefs.push({ documentId: node.documentId });
      } else if (node.type === "strapi-entry" && node.documentId) {
        entryRefs.push({
          documentId: node.documentId,
          contentType: node.contentType
        });
      }

      if (node.children) {
        traverseNodes(node.children);
      }
    });
  }

  traverseNodes(editorState.root.children);

  return {
    media: mediaRefs,
    entries: entryRefs
  };
}
```

### 4. 既存コンポーネントの改良

#### A. StrapiImageComponent の更新

```typescript
// 定期更新の代わりに、populated データから最新情報を取得
export default function StrapiImageComponent({
  documentId,
  src,
  nodeKey,
  populatedData
}) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    // populated データから最新の src を取得
    const latestMedia = populatedData?.lexicalContentMedia?.find(
      (media) => media.documentId === documentId
    );

    if (latestMedia && latestMedia.url !== currentSrc) {
      setCurrentSrc(latestMedia.url);
      // エディタ状態も更新
      updateImageNodeInEditor(nodeKey, latestMedia);
    }
  }, [populatedData, documentId, currentSrc]);
}
```

### 5. API ルートの追加

```typescript
// server/src/routes/index.ts
export default [
  {
    method: "GET",
    path: "/populated/:contentType/:documentId",
    handler: "lexical-populate.findWithPopulate",
    config: {
      policies: []
    }
  }
];
```

## 🔄 実装フロー

### 保存時

1. **Lexical Editor** で内容編集
2. **OnChange Plugin** が参照情報を抽出
3. **メイン JSON + 隠しリレーション** を同時保存

### 取得時

1. **API コール**で populate 指定
2. **Controller** が隠しリレーションを解決
3. **populate ユーティリティ**が JSON 内の参照をマージ
4. **フロントエンド**が最新情報で表示

### 更新検知時

1. **定期チェック**または**Webhook**で更新検知
2. **populated API**で最新データ取得
3. **React State**で UI 更新
4. 必要に応じて**エディタ状態も更新**

## ⚡ 段階的実装計画

### Phase 1: 基盤整備

- [ ] 隠しフィールドの自動追加機構
- [ ] 参照抽出ユーティリティ
- [ ] populate コントローラー

### Phase 2: Image 対応

- [ ] StrapiImageNode の populate 対応
- [ ] Media 参照の自動解決
- [ ] UI での最新画像表示

### Phase 3: Entry 対応

- [ ] StrapiEntryNode の populate 対応
- [ ] エントリ参照の自動解決
- [ ] 関連データの最新情報表示

### Phase 4: 最適化

- [ ] キャッシュ機構
- [ ] 差分更新
- [ ] パフォーマンス改善

## 🎯 期待される効果

1. **真の連動性**: Strapi 公式 Rich Text と同等の参照更新機能
2. **WYSIWYG 維持**: Lexical エディタの使用感は変更なし
3. **拡張性**: 新しい参照タイプへの対応が容易
4. **パフォーマンス**: 必要時のみ populate で効率的

これにより、lexical-editor-rabo プラグインは Strapi の公式エディタと同等の、真に「連動する」リッチテキストエディタとして機能するようになりますわ。
