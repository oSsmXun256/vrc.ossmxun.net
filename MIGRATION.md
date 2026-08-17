# vrc.ossmxun.net MinaUI migration notes

## Baseline (2026-08-18)

- Repository is a static site; there is no package manager, build script, or
  `AGENTS.md` in this repository or its immediate parent directories.
- `index.html` owns the page-specific layout and behavior. The migrated page
  loads the vendored `minaui.css`, `minaui.js`, and its site extension
  `minaui.glass.js`.
- The six HTTP error pages (`400.html`, `401.html`, `403.html`, `404.html`,
  `500.html`, `502.html`) load the vendored MinaUI bundle and use MinaUI
  utility/component classes.
- `minaui.css` and `minaui.js` are vendored from the revised MinaUI core
  distribution (the VRC copies are SHA256-identical to the core source). The
  optional WebGL module is also based on the revised `minaui.glass.js`; its
  compatibility-only Aqua canvas/selector/alias paths are intentionally
  removed because this page has fully migrated to Mina names. The separate
  `minaui-aqua-compat.css` package is not linked.
  Audit hashes: `minaui.css` (70,600 bytes) `45DBD7005B445B561E9B78CCE34D7DD1FB151201DC52E52107A358545D00DE2A`,
  `minaui.js` `97EB6459D304416D5DC946C3D4114BA54DA5C88139CEAA3769ED02DA1E086D70`.
  The official optional core glass module is `B4EB46D7DA0F53F0AF6CE23B9CA53A02B007C17E4A3C80935188E5B35E416772` (18,098 bytes);
  the VRC copy intentionally differs only by removing its legacy Aqua canvas
  fallback, Aqua selector compatibility, and Aqua global alias so active
  HTML/JS contains no archived namespace. The renderer, shader, resize/scroll
  invalidation, texture upload, and `maxCards` implementation are otherwise
  kept from that revised module. The VRC copy also keeps the revised
  `options.saturate === undefined ? 1.2 : options.saturate` defaulting logic,
  so an explicit `saturate: 0` remains a valid neutral-saturation setting.
- Existing user content that must remain unchanged: avatar/logo assets,
  `memories/list.json`, all `memories/thumb` and `memories/comp` images, the
  profile copy/links, and the photo URLs in the JSON files.

## Behavior to preserve

1. A fixed, dark photo background rendered by the WebGL liquid-glass canvas.
2. The top-centered profile card with avatar, tags, stats, and external links.
3. The first-screen “Memories / scroll” hint and the scrollable photo area.
4. Year/month filter buttons, including active state and collage re-rendering.
5. Lazy-loaded diamond photo collage, responsive cell size, and hover zoom.
6. Lightbox open/close behavior (close button, backdrop click, and full image).
7. Resize behavior and the mobile layout breakpoint at 640px.

## MinaUI integration boundary

MinaUI supplies the generic reset, design tokens, glass surface, button, card,
layout, typography, spacing, and effect utilities. The following remain
site-specific because they encode this gallery's content or geometry:

- `.profile-card`, `.card-*`, `.tags`, `.tag`, `.stat-*`, `.card-link`;
- `.bg-*`, `.scroll-area`, `.hero-*`, `.photos-area`;
- `.diamond-*`, `.filter-*`, and `.lightbox`;
- the photo data fetch and diamond tessellation/lightbox JavaScript.

The migration must link the MinaUI bundle and use its `mina-*` classes/tokens
for shared UI, while keeping the above selectors and DOM structure stable.
The liquid-glass script may remain a page-specific WebGL extension, but its
public canvas/class names should use the Mina namespace (`mina-*`) and must not
change the rendered composition.

The original `aqua.design.css`, `aqua.style.css`, `aqua.effect.css`, and
`aqua.glass.js` files were removed after the active-reference audit. Git history
retains the archived implementation for rollback/reference; no Aqua-named asset
is part of the working tree or any active HTML dependency.

## AquaCSS 2.0 audit and MinaUI correspondence

The pre-migration `index.html` was compared against the archived Aqua assets
and its DOM was kept stable. The following table records the semantic mapping;
the right-hand values are deliberately pinned by the page-local rules where a
generic MinaUI component would otherwise change the established composition.

| Existing responsibility | AquaCSS 2.0 before | MinaUI after | Visual/behavior contract |
| --- | --- | --- | --- |
| Liquid glass surfaces | `.aqua-glass-liquid` + `#aqua-glcanvas` | `.mina-glass mina-glass--liquid` (the `.mina-glass-liquid` API alias is also supported) + `#mina-glcanvas` + `MinaGlass.autoInit({ maxCards: 2 })` | `position:relative`, `overflow:hidden`, transparent native surface, white text shadow, canvas `fixed/100vw/100vh`, pointer-events disabled; the two tracked surfaces reproduce Aqua's original page limit |
| Theme tokens | `--aqua-primary*`, `--aqua-gradient-primary`, `--aqua-glass-*` | `--mina-primary*`, `--mina-gradient-primary`, `--mina-glass-*` | VRC pink palette and the two-stop active-filter gradient are byte-for-byte the same values; only the namespace changes |
| Generic glass surface (error pages) | `.aqua-glass` | `.mina-glass mina-glass--sm` | `rgba(255,255,255,.1)` background, `.45` white border, 12px radius, 22px blur, 120% saturation, and the old outer + inset shadow |
| Primary/glass actions | `.aqua-btn aqua-btn-primary`, `.aqua-btn-glass` | `.mina-btn mina-btn--primary`, `.mina-btn--glass` | 10px 16px padding, 12px radius, primary `#4e70df`/hover `#6b8aff`; no Mina elevation/transform is allowed to change the old error-page controls |
| Layout/spacing utilities | `.aqua-flex`, `.aqua-items-center`, `.aqua-justify-center`, `.aqua-flex-col`, `.aqua-gap-*`, `.aqua-p-*`, `.aqua-w-full`, `.aqua-min-h-screen` | `.mina-flex`, `.mina-flex--center`, `.mina-flex--column`, `.mina-gap-*`, `.mina-p-*`, `.mina-w-full`, `.mina-min-h-screen` | Error-page centering, max width, padding, and vertical rhythm stay unchanged |
| Typography | `.aqua-heading-2`, `.aqua-text-sm`, `.aqua-leading-relaxed`, `.aqua-m-0` | `.mina-h2`, `.mina-small`, local line-height, `.mina-m-0` | Error heading remains 24px/700; body line-height remains 1.75 |
| Profile identity | site-specific `.profile-card`, `.card-*` | same selectors plus `.mina-glass`, `.mina-avatar`, `.mina-avatar--lg` | Card grid, 880px desktop width, 40px desktop top, 16px mobile top, and avatar dimensions remain site-owned |
| Tags and stats | site-specific `.tags`, `.tag`, `.stat-item` | same selectors plus `.mina-tag-list`, `.mina-chip`, `.mina-stat` | Existing 6px tag gap, 4px/11px chip padding, and 8px/12px stat padding are restored after generic defaults |
| Photo filter | `.filter-btn` with Aqua gradient token | `.filter-btn mina-btn mina-btn--pill`, `--mina-gradient-primary` | Filter count/order and active gradient are unchanged; generic button min-height/hover lift are reset |
| Lightbox | `.lightbox.open` and custom click handlers | `.lightbox mina-modal`, `MinaUI.open/close()`, plus `.open` compatibility class | Existing 0.25s opacity transition, `z-index:200`, backdrop click, close button, and image sizing are retained; `aria-hidden` tracks state |
| Effects | `aqua.effect.css` was linked but no `.aqua-*` effect class was used by the page | MinaUI motion utilities remain available (`.mina-anim-*`, `.mina-hover-*`) | Gallery fade/zoom transitions are site-specific and remain unchanged; no unused Aqua effect bundle is linked |

### Before/after comparison basis

The archived DOM and CSS establish the baseline values above. The migration
keeps the same profile copy/links, `memories/list.json` source, diamond
tessellation constants (`S=225` desktop / `150` mobile, `GAP=5`), filter
categories, lightbox source paths, canvas sizing, and 640px breakpoint. The
desktop/mobile smoke checks should record the following invariants after any
future MinaUI bundle update:

- desktop 1280px viewport: profile width `880px`, top `40px`, canvas fills the
  viewport, 12 filter controls, and 112 photo items for “全部”;
- mobile 390px viewport: profile width remains within the 92vw card rule,
  avatar is `56px`, diamond cell is `150px`, and the filter remains usable;
- filter selection changes only the photo count (for example `2024年` → 68)
  and keeps the active Mina button state;
- opening a diamond sets both `open`/`is-open` and `aria-hidden="false"`, while
  the close button, Escape key, and backdrop restore the closed state;
- all six error pages use local Mina assets and contain no active Aqua
  stylesheet/script reference.

## Gallery regression fixes (2026-08-18)

- Diamond tiles now make the clipped `.diamond-inner` the only pointer target;
  the rectangular positioning wrapper ignores pointer events, and keyboard
  activation uses the same target. Hit testing is calculated from the clipped
  element's live rectangle, so gaps and overlapping wrappers cannot open an
  adjacent image.
- The photo stack is isolated below the filter stack (`.diamond-area` 0,
  tiles 1, filter bar 50) so the sticky liquid-glass filter remains above the
  collage within the scroll-area stacking context.
- Lightbox images are preloaded and decoded before the hidden image is made
  visible. A request token prevents a slower previous selection from winning.
  Closing uses a dedicated exit animation; only its `animationend` (or the
  guarded timeout fallback) updates `hidden`/`aria-hidden`, clears the old
  source, and restores focus to the tile.
- The close control is pinned to 40x40px with a non-shrinking 1:1 aspect ratio.
  `BIG_RATIO` is 0.24 (previously 0.14), increasing medium cells without
  changing the 112-image data set.

## Acceptance checks

- No page links the archived Aqua CSS/JS as its active stylesheet/script.
- Every linked MinaUI asset exists locally or is served by the MinaUI CDN path
  chosen by the core package.
- `index.html` still contains the same profile text, links, JSON source, and
  image source paths; only framework names and site styling wrappers change.
- The six error pages retain their copy and actions while using MinaUI utility
  and component classes.
- Static HTML/reference checks pass, and the gallery behavior is exercised at
  desktop and mobile widths (filter, lightbox, resize).
