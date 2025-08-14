> Strapi 公式のRich Text Editorは挿入した画像は元画像を更新すると連動して記事内の要素も更新されるけど、他のeditor pluginはURLを挿入しているだけなので更新されない。公式のRich Text Editorはどうやって要素の連動を達成している？

### 🎀 要約

**公式 Rich Text（Blocks）** は、画像を単なる `<img src>` 文字列として保存せず、**Media Library（Upload プラグイン）のアセット“レコード”への参照**として保持いたしますの。
API 取得時に `populate` で解決するとブロック内の `image` に **最新のアセット情報（`url`, `width`, `height`, `alternativeText` など）** がインライン展開されます。いっぽう、外部製エディタプラグインの多くは **URL を直書き**するだけですので、メディア差し替えに追随いたしませんわ。 ([docs.strapi.io][1], [GitHub][2])

---

## 💎 詳細（なぜ連動するのか）

1. **画像は“関係（relation）”として扱われる**
   Blocks フィールドは「段落・見出し・画像…」といった**型付き JSON**で保存され、画像ブロックは Media Library のアセットを参照します。React 用公式レンダラーも `image` ブロックに \*\*オブジェクト（`image` プロップ）\*\*が渡る前提で設計されておりますの。つまり **URL スナップショットではない**のですわ。 ([GitHub][2])

2. **API 側で参照を解決（populate）**
   REST は既定でリレーションを展開しませんので、`?populate=<blocks フィールド名>`（あるいは `*`）を付与して取得します。これにより `image` ノードが **メディア実体の最新情報**を含んだ形で返却されます。 ([docs.strapi.io][1])

3. **「Replace Media」が“同じレコードの中身だけ”を差し替える**
   Media Library の **Replace Media** は**ファイルだけを置き換えて同じアセットレコードを維持**します。よって、そのレコードを参照しているすべてのエントリ（＝Blocks 内の画像ブロック含む）が**自動的に新ファイルへ切り替わる**仕組みでございます。 ([docs.strapi.io][3], [strapi.io][4])

4. **Strapi v5 の識別子（documentId）**
   v5 ではドキュメント識別に `documentId` を用いるため、**参照の安定性**が高く、ロケールや下書き/公開の切替を跨いでも参照が破綻しにくい設計でございます。 ([docs.strapi.io][5])

---

## 📎 付録：実装メモ

- **REST の例**

  ```
  GET /api/articles/123?populate[content]=*
  ```

  返却 JSON の Blocks には、`{ type: "image", image: { url, width, height, alternativeText, … } }` のように**最新のメディア情報**が入ってまいりますわ。 ([Nuxt][6])

- **レンダリング（React）**
  公式レンダラー `@strapi/blocks-react-renderer` の `blocks.image` には **`image` オブジェクト**が渡るため、そのまま `img` や Next.js `Image` にマッピングすれば連動描画が成立いたします。 ([GitHub][2])

---

### まとめ

- 公式 Rich Text（Blocks）：**メディア“レコード”参照 → populate で解決 → Replace Media で一括更新**。
- 他プラグイン（URL 直書き型）：**レコード参照なし → 差し替え非連動**。

以上の仕組みにより、\*\*公式エディタだけが「画像差し替えに自動追随」\*\*を実現しているのでございますわ。

[1]: https://docs.strapi.io/cms/api/rest/populate-select?utm_source=chatgpt.com "REST API: Population & Field Selection"
[2]: https://github.com/strapi/blocks-react-renderer "GitHub - strapi/blocks-react-renderer: A React renderer for the Strapi's Blocks rich text editor"
[3]: https://docs.strapi.io/cms/features/media-library?utm_source=chatgpt.com "Media Library | Strapi 5 Documentation"
[4]: https://strapi.io/features/media-library?utm_source=chatgpt.com "Media Library - Strapi Features"
[5]: https://docs.strapi.io/cms/api/rest?utm_source=chatgpt.com "REST API reference | Strapi 5 Documentation"
[6]: https://nuxt.com/modules/nuxt-strapi-blocks-renderer?utm_source=chatgpt.com "nuxt-strapi-blocks-renderer · Nuxt Modules"

> populateが使えるJSONをPluginとして保存できるだろうか？

### 🎀 要約

- **結論**: **“JSON 1 本のカスタムフィールド”に対して `populate` を直接効かせることはできませんわ。** `populate` は **relation / media / component / dynamic zone** にのみ適用され、**任意 JSON の中身**は解決対象ではございませんの。([docs.strapi.io][1])
- **実現策**: 公式 Rich Text（Blocks）と同様に、**参照先は別フィールドとして relation／media を定義**→ API で `populate` → **コントローラや Document Service Middleware で JSON と合体**、という設計にすれば「連動する JSON 表現」を **プラグインとして保存・配信**できますわ。([docs.strapi.io][2])

---

## 💎 詳細

#### なぜ JSON だけでは不可か

- Strapi の `populate` は **リレーション系属性**（relation / media / component / dynamic zone）を解決する仕組みで、**通常の `json` 型**は対象外でございます。([docs.strapi.io][3])
- さらに **カスタムフィールド**は新しいデータ型を追加できず、**relation・media など“特別な型”を内包するフィールドは作れません**。ゆえに「JSON の中に埋めた ID を自動解決」は不可でございますの。([docs.strapi.io][1])

#### 実現パターン（推奨）

1. **シャドウ参照方式（実務で安定）**

- プラグインの UI で JSON（エディタ出力）を保存しつつ、**同一コンテントタイプに “隠し” relation／media 属性**（例：`contentLinks[]`, `contentMedia[]`）へ **参照先を同期保存**。
- 取得時は `populate: ['contentLinks', 'contentMedia']` を指定し、**コントローラ or Document Service Middleware** で **JSON に注入**して返却。

  - `populate` の仕様（どの属性が解決対象か）と、**コントローラ拡張 / Document Service Middleware** は公式が推奨する拡張ポイントでございます。([docs.strapi.io][3])

2. **コンポーネント化（WYSIWYG 要件が緩い場合）**

- JSON ではなく **component / dynamic zone** で構造化し、参照は素直に relation として持つ。
- `populate='*'` または個別指定で解決され、そのまま配信できます。([docs.strapi.io][4])

---

## 🧩 最小実装メモ（v5, REST）

**コントローラ拡張**で「参照の解決 → JSON へマージ」を行う例でございますわ。

```ts
// src/api/article/controllers/article.ts
import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::article.article",
  ({ strapi }) => ({
    async find(ctx) {
      const docs = await strapi.documents("api::article.article").findMany({
        ...ctx.query,
        populate: ["contentLinks", "contentMedia"] // シャドウ参照を解決
      });
      const merged = docs.map((doc) => mergeIntoJson(doc)); // JSONへ注入（自作）
      ctx.body = merged;
    }
  })
);
```

- `populate` の使い方（REST/Document Service）は公式通り。([docs.strapi.io][3])
- コントローラ拡張の入口は `createCoreController` でございます。([docs.strapi.io][2])
- **全タイプ横断**でやるなら **Document Service Middleware** にしてもよろしゅうございます。([docs.strapi.io][5])

---

## 📎 付録：判断基準

- **WYSIWYG 維持必須** → _シャドウ参照方式_（JSON＋別 relation/media）。
- **構造化優先・WYSIWYG 不問** → _component / dynamic zone 化_。
- いずれも **`json` 単体では `populate` 不可**が前提でございますわ。([docs.strapi.io][1])

必要でしたら、「Lexical 風 UI で relation を裏に同期保存するプラグイン雛形」をお作りしますわ。

[1]: https://docs.strapi.io/cms/features/custom-fields?utm_source=chatgpt.com "Custom Fields | Strapi 5 Documentation"
[2]: https://docs.strapi.io/cms/backend-customization/controllers?utm_source=chatgpt.com "Controllers | Strapi 5 Documentation"
[3]: https://docs.strapi.io/cms/api/rest/populate-select?utm_source=chatgpt.com "REST API: Population & Field Selection - Strapi 5 Docs"
[4]: https://docs.strapi.io/cms/api/document-service/populate?utm_source=chatgpt.com "Using Populate with the Document Service API"
[5]: https://docs.strapi.io/cms/api/document-service/middlewares?utm_source=chatgpt.com "Document Service API: Middlewares"
