# MinaUI ガイド

## 設計方針

MinaUI のコンポーネントは、次の 3 層に分かれています。

1. **トークン** — `--mina-*` 変数。色、余白、角丸、影、ブレークポイントに相当する値を管理します。
2. **プリミティブ** — `mina-container`、`mina-grid`、`mina-flex`、`mina-stack`、`mina-cluster`、`mina-glass`。
3. **コンポーネント** — typography、`mina-card`、`mina-btn`、badge、form、navigation / tabs / dropdown、table / list / stat、feedback（`mina-alert` / `mina-toast` / progress / skeleton）、media / avatar、modal / drawer / tooltip、utilities。

固有のサイト表現は、まずトークンとプリミティブで組み立て、専用セレクタはサイト側に残してください。これにより同じ HTML をテーマ変更や別サイトに再利用できます。

## レイアウト

```html
<div class="mina-container mina-container--wide">
  <div class="mina-grid mina-grid--wide">
    <article class="mina-card">
      <div class="mina-card__body">メインコンテンツ</div>
    </article>
    <aside class="mina-panel">サイドバー</aside>
  </div>
</div>
```

`mina-grid--auto` はカードの最小幅を保ちながら自動で列数を変えます。`mina-grid--2`〜`--4` は明示列、`mina-grid--sidebar` は本文とサイドバー用です。`mina-stack--1`〜`--8` と `mina-gap-*` で余白を調整できます。

## サーフェス

```html
<section class="mina-glass mina-glass--light mina-p-6">半透明の面</section>
<article class="mina-card mina-card--interactive mina-card--glow">
  <header class="mina-card__header">
    <h2 class="mina-card__title">プロフィール</h2>
    <p class="mina-card__subtitle">更新日時を表示</p>
  </header>
  <div class="mina-card__body">本文</div>
  <footer class="mina-card__footer mina-cluster mina-cluster--between">操作</footer>
</article>
```

`mina-card--interactive` はホバー時にわずかに浮き、`mina-card--glow` はブランド色の光を追加します。背景写真や WebGL を使う場合は、背景レイヤーを `mina-backdrop`、前景を `mina-shell` の子要素にしてください。

### すりガラス（backdrop-filter）はオプトイン

`.mina-card` / `.mina-panel` は半透明の面を保ちますが、デフォルトでは backdrop-filter を要求しません。すりガラスの屈折表現が要る要素にだけ `.mina-glass` を追加します。

```html
<article class="mina-card mina-glass">このカードだけblurされる</article>
```

カードやパネルを多数並べるページでは、これだけでSafari・低性能端末の描画負荷が大きく下がります。コンポジットレイヤーの明示的な昇格が必要な特殊ケースは `.mina-gpu` を使ってください。

## パフォーマンス設計

### Performance Mode

`<html data-mina-performance="...">` で3段階を指定できます。省略時は `balanced` です。

```html
<html data-mina-performance="performance">
```

- `quality` — 全エフェクト。animated backdrop-filter（`mina-glass-blur-in` 等）も有効。
- `balanced` — 見た目はqualityと同じですが、blurアニメーションはopacityフェードに置き換わります。
- `performance` — blurの縮小・無効化、glow/巨大影の削減、無限系の装飾アニメ停止。面の不透明度を上げて可読性を維持します。

`prefers-reduced-motion` が指定された環境では、Performance Modeより先にモーション全体が抑制されます。

### MinaUI GlassとWebGL液体ガラス

WebGLを使う液体ガラスは `.mina-glass--liquid` / `.mina-glass-liquid` を要素に付け、`minaui.glass.js` を読み込んで `MinaGlass.autoInit()` を呼びます。詳細なオプション（`quality` / `backend` / `renderScale` / `maxPixelCount`）とBackend選択（`webgl` / `native` / `static`）は README の「MinaGlass WebGL」を参照してください。

- Safari / iOS では `auto` がCSS backdrop-filterの `native` backendを選び、固定キャンバスの座標追跡が非同期スクロールでずれる問題を回避します。
- Firefox や WebGL2が使えない環境でも native/static へ自動フォールバックし、Context Lostでもページが壊れません。
- Liquid Glass以外の `.mina-glass` 全般も Performance Mode の対象です（blur削減、影削減など）。

### Layer契約

Liquid Glass用キャンバスを含む重ね順は変数で定義されています。サイト固有のz-indexハックの代わりにこれらを使ってください。

```css
--mina-z-backdrop-deep /* 背景オーラ */ < --mina-z-backdrop /* 背景写真 */
< --mina-z-glass-canvas /* WebGLキャンバス */ < 通常コンテンツ < --mina-z-sticky
< dropdown < drawer < overlay < modal < toast < tooltip
```

## テーマとブランド

属性は `<html>`、`<body>`、ページ単位のラッパーのいずれに置いても構いません。

```html
<div data-theme="light" data-style="flat" data-accent="cyan">
  <div class="mina-card">同じクラスでライト・フラット表示</div>
</div>
```

サイト独自のトークンは `.mina-theme-custom` のようなラッパーで上書きすると、他のページへの影響を避けられます。

```css
.mina-theme-custom {
  --mina-bg: #07111f;
  --mina-primary: #38bdf8;
  --mina-primary-soft: rgba(56, 189, 248, .18);
}
```

## フォーム

```html
<div class="mina-field">
  <label class="mina-field__label" for="name">表示名</label>
  <input id="name" class="mina-input" placeholder="お刺身くん">
  <span class="mina-field__hint">プロフィールに表示されます。</span>
</div>

<label class="mina-check">
  <input type="checkbox" checked>
  <span>公開プロフィールに表示</span>
</label>

<label class="mina-switch">
  <input type="checkbox" checked>
  <span class="mina-switch__track"><span class="mina-switch__thumb"></span></span>
</label>
```

エラー時は `aria-invalid="true"` と `.mina-field__error` を併用します。ラベルを省略せず、アイコンだけのボタンには `aria-label` を付けてください。

## フィードバック

インラインの状態説明には `mina-alert`、一時的な通知には `mina-toast`、処理量には `mina-progress`、読み込み中のプレースホルダーには `mina-skeleton` を使います。

```html
<div class="mina-alert mina-alert--success" role="status">
  <span class="mina-alert__icon" aria-hidden="true">✓</span>
  <div class="mina-alert__content">
    <p class="mina-alert__title">保存しました</p>
    <p class="mina-alert__message">プロフィールの変更が反映されています。</p>
  </div>
</div>
<div class="mina-progress" role="progressbar" aria-valuenow="70" aria-valuemin="0" aria-valuemax="100">
  <span class="mina-progress__value" style="--mina-progress: 70%"></span>
</div>
```

## タブ、ドロップダウン、モーダル

タブは `data-mina-tabs` を親に置き、タブの `data-mina-tab` とパネルの `id` を一致させます。

```html
<div data-mina-tabs>
  <div class="mina-tabs">
    <button class="mina-tabs__tab" data-mina-tab="overview" aria-selected="true">概要</button>
    <button class="mina-tabs__tab" data-mina-tab="activity" aria-selected="false">活動</button>
  </div>
  <section id="overview" class="mina-tabs__panel">概要の内容</section>
  <section id="activity" class="mina-tabs__panel" hidden>活動の内容</section>
</div>
```

モーダルとドロワーは、閉じる操作とフォーカスの戻し先をサイト側で必要に応じて追加してください。MinaUI の JS は Escape、バックドロップ、`aria-expanded` / `aria-hidden` の切り替えを提供します。

```html
<button class="mina-btn mina-btn--primary" data-mina-toggle="#contact">連絡する</button>
<section id="contact" class="mina-modal" aria-hidden="true">
  <div class="mina-modal__dialog" role="dialog" aria-modal="true">
    <div class="mina-modal__body">フォーム</div>
    <footer class="mina-modal__footer">
      <button class="mina-btn" data-mina-close>閉じる</button>
    </footer>
  </div>
</section>
```

## VRC 移行時の境界

`vrc.ossmxun.net` の現在のデザインは、固定 WebGL キャンバス、写真スライドショー、写真フィルター、Lightbox、リサイズ処理を持つため、それらを MinaUI のコンポーネントに置き換える必要はありません。

- ページ全体に `.mina-shell` を追加し、背景は `.mina-backdrop` として保持する。
- 既存 `.profile-card`、`.photo-card` のレイアウトはサイト CSS に残し、表面・ボタン・タグだけ MinaUI のクラスへ寄せる。
- `data-style="flat"` を指定すれば、MinaUI の影とブラーを無効にして写真の視認性を優先できる。
- `prefers-reduced-motion` は MinaUI と既存エフェクトの両方で尊重する。

旧AquaCSS 2.0のセレクタ、変数、エフェクト、AquaGlass APIの全対応表は `AQUA-MIGRATION.md` を参照してください。互換レイヤーが必要な段階移行では `minaui-aqua-compat.css` を `minaui.css` の後に読み込み、移行完了後に外します。WebGLを使う場合は `minaui.glass.js` をページ単位で追加します。

## アクセシビリティ

フォーカスリングは `:focus-visible` で常に表示されます。コントラストを保つため、透明度の高いテキストには `mina-text-muted` / `mina-text-subtle` を用途に応じて選びます。装飾的な背景は `aria-hidden="true"` とし、モーダルは `role="dialog"`、`aria-modal="true"`、`aria-labelledby` を設定してください。
