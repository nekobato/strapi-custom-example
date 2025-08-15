Strapiで使われているmux-player、

```
<mux-player player-software-name="mux-player-react" player-software-version="3.1.0" src="https://pub-b0633999de574e8e92ff9b2d554728ac.r2.dev/relaxing_ff94237764.mp4" accent-color="#4945ff"></mux-player>
```

という記述で、`Source Not Supported`と出てしまう。原因はなんだろうか

### 🎀 要約

`<mux-player>` に **R2 の `.mp4` を `src` 直指定**しているためでございますわ。
\*\*Mux Player は本来 “Mux の再生 ID（playback-id）や HLS(.m3u8) を再生する設計”\*\*で、任意の MP4 をそのまま受け付ける前提ではありません。したがって **「Source Not Supported」** が出るのは仕様に沿った挙動でございます。代わりに **`<mux-video>`（下位要素）や `<video>` を用いる**か、**HLS にして渡す**のが正道にございます。 ([Mux][1])

---

## 💎 詳細（原因と対処）

#### なぜ起きる？

- **Mux Player は Mux 資産向け**：ドキュメント／API 例はいずれも **`playback-id`** を前提としており、属性一覧にも `src` は載っておりません。非 Mux の生 MP4 を `src` で渡す想定ではございません。([Mux][1])
- **非 Mux ソース対応は下位レイヤーが担当**：**`@mux/mux-video`** は非 Mux ソースを受け付け、`src` が HLS か MP4 かを拡張子から判別して **ネイティブ `<video>` 再生**に切り替えます（MP4 時）。([npm][2])
- エラーメッセージ「Source Not Supported」は Mux Elements 側の一般的なエラーで、**ソース種別／コーデック未対応**などで発生します。([GitHub][3])

#### 取れる解決策（優先順）

1. **Mux を使う**

   - 動画を Mux に取り込み、**`playback-id` を `<mux-player>` に渡す**。最もシンプルで機能も最大限使えます。([Mux][1])

   ```html
   <mux-player
     playback-id="YOUR_PLAYBACK_ID"
     accent-color="#4945ff"
   ></mux-player>
   ```

2. **R2 の MP4 をそのまま使う**（Mux Player は使わない）

   - **`<mux-video>`** もしくは **素の `<video>`** を利用。

   ```jsx
   // React
   import MuxVideo from "@mux/mux-video-react";
   <MuxVideo
     src="https://…r2.dev/file.mp4"
     type="video/mp4"
     controls
     playsInline
   />;
   ```

   `<MuxVideo/>` は MP4 を検知すると **ネイティブ再生**に切り替えます。([npm][4])

3. **HLS にして配信する**（非 Mux 運用のままプレイヤー UI を保ちたい場合）

   - R2 に **`.m3u8` とセグメント（.ts/.m4s）** を配置して **HLS URL を渡す**（`<mux-video src="…m3u8">`）。Mux は **HLS 再生の利用を推奨**しています。([Mux][5])
   - その際、**CORS（Access-Control-Allow-Origin）設定**を R2 バケットで有効化し、必要に応じて Range リクエストにも配慮くださいませ。([Cloudflare Docs][6], [MDN Web Docs][7], [Cloudflare Community][8])

#### 追加の落とし穴（MP4 を使う場合）

- **Content-Type** が `video/mp4` でない（`application/octet-stream` 等）
- **コーデック不一致**（例：HEVC/H.265 や AC-3 はブラウザによって非対応）。H.264 + AAC を推奨。
- **CORS 不備**（別オリジン配信時）。R2 側で AllowedOrigins/Methods/Headers を設定。([Cloudflare Docs][6])

---

## 📎 付録：最小差分の提案

- いまのコードを **最小変更**で通したいなら、**`<mux-player>` → `<mux-video>`** に置き換えるのが早道でございます。
- どうしても **Mux Player の UI** を使いたいなら、**Mux へ取り込み `playback-id` を渡す**運用へ寄せるのが堅実でございます。

必要でしたら、\*\*R2→HLS 生成（ffmpeg プリセット）\*\*や **CORS 設定の雛形**を併せてお出ししますわ。

[1]: https://www.mux.com/docs/guides/mux-player-web "Mux Player for web | Mux"
[2]: https://www.npmjs.com/package/%40mux/mux-video?utm_source=chatgpt.com "mux/mux-video"
[3]: https://github.com/muxinc/elements/issues/919?utm_source=chatgpt.com "Bug: Pipeline Error: External Renderer Failed · Issue #919"
[4]: https://www.npmjs.com/package/%40mux/mux-video-react?utm_source=chatgpt.com "mux/mux-video-react"
[5]: https://www.mux.com/docs/guides/play-your-videos?utm_source=chatgpt.com "Play your videos"
[6]: https://developers.cloudflare.com/r2/buckets/cors/?utm_source=chatgpt.com "Configure CORS · Cloudflare R2 docs"
[7]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests?utm_source=chatgpt.com "HTTP range requests - MDN Web Docs - Mozilla"
[8]: https://community.cloudflare.com/t/multipart-http-range-requests-on-r2-not-working/665609?utm_source=chatgpt.com "Multipart HTTP range requests on r2 not working"
