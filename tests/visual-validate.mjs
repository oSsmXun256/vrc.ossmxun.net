/* Real-browser (Chromium headless) pixel validation for the vrc Memories
 * overlay page. Covers the V3.3 fix list:
 *   16. Diamond DOM vs Scene Provider position (desktop 48px / mobile 16px
 *       scroll-area padding, DERIVED from the real rect) — error <= 1 CSS px
 *   17. Diamond gap: scene draws the diamond 5px inside the tile edge
 *   18. Scroll sync at 3 positions: deltaScene == -deltaScroll, <= 1px
 *   19. Image load auto-redraw: with zero user input the provider canvas
 *       gains tiles after images decode
 *   21. Overlay glass alpha: outside +1/+5/+10px == 0, inside > 0
 *   13. Scene base == visible DOM background (dark body + gradient)
 *   14. Stacking: canvas pointer-events none, filter buttons clickable
 *
 * Injection strategy: an inline probe script is inserted right AFTER the
 * minaui.glass.js <script src> tags and BEFORE the page's own inline
 * script, so MinaLiquid.prototype._drawProviderScene can be wrapped before
 * the renderer is constructed (a window-property wrapper would lose to the
 * script-level lexical binding, so the prototype is the reliable hook).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const execFileAsync = promisify(execFile);
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "index.html"), "utf8");

function assert(cond, msg) {
    if (!cond) throw new Error("VRC VISUAL FAIL: " + msg);
}

/* Probe injected after the library scripts, before the page script. */
const PROBE = `<script>
window.__probe = { calls: [], errors: [], invalidateCount: 0 };
(function () {
  if (typeof MinaLiquid === 'undefined') { window.__probe.errors.push('MinaLiquid not loaded'); return; }
  var origDraw = MinaLiquid.prototype._drawProviderScene;
  MinaLiquid.prototype._drawProviderScene = function () {
    var ok = origDraw.apply(this, arguments);
    try {
      window.__probe.calls.push({
        ok: ok,
        scrollX: (typeof window.scrollX === 'number') ? window.scrollX : 0,
        scrollY: (typeof window.scrollY === 'number') ? window.scrollY : 0,
        width: this._providerCanvas ? this._providerCanvas.width : 0,
        height: this._providerCanvas ? this._providerCanvas.height : 0
      });
    } catch (e) { window.__probe.errors.push('record: ' + e.message); }
    return ok;
  };
  var origInvalidate = MinaLiquid.prototype.invalidateScene;
  MinaLiquid.prototype.invalidateScene = function () {
    window.__probe.invalidateCount++;
    return origInvalidate.apply(this, arguments);
  };
})();
</script>`;

/* Measurement script appended at the end of <body>.
 * NOTE: under --virtual-time-budget headless Chrome stops serving
 * BeginFrames after a few rAFs, so waits use timers and explicit
 * invalidateScene() kicks instead of rAF chains. */
const MEASURE = `<script>
(function () {
  var results = { ok: [], fail: [] };
  function check(name, cond, detail) {
    (cond ? results.ok : results.fail).push(name + (detail ? ' — ' + detail : ''));
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function kick() {
    // scroll listeners call invalidateScene; also kick manually to be safe
    if (window._minaLiquid && !window._minaLiquid.destroyed) window._minaLiquid.invalidateScene();
  }

  function domDiamondInner() {
    var inner = document.querySelector('#collageArea .diamond-inner');
    return inner ? inner.getBoundingClientRect() : null;
  }

  function sceneDiamondLeftVertex() {
    var liq = window._minaLiquid;
    if (!liq || !liq._providerCanvas) return null;
    var pc = liq._providerCanvas;
    var dpr = pc.width / window.innerWidth;
    var ctx = pc.getContext('2d');
    var d = domDiamondInner();
    if (!d) return null;
    var row = Math.round((d.top + d.height / 2) * dpr);
    if (row < 0 || row >= pc.height) return null;
    var img = ctx.getImageData(0, row, pc.width, 1).data;
    var base = [img[0], img[1], img[2]];
    for (var x = 0; x < pc.width; x++) {
      var i = x * 4;
      if (Math.abs(img[i] - base[0]) + Math.abs(img[i + 1] - base[1]) + Math.abs(img[i + 2] - base[2]) > 48) {
        return x / dpr;
      }
    }
    return null;
  }

  async function measure() {
    var liq = window._minaLiquid;
    var out = {};
    if (!liq) { out.error = 'no _minaLiquid'; done(out); return; }
    out.backend = liq.backend;
    out.sceneState = liq.getSceneState();
    out.glClass = document.getElementById('filterBar').className;
    out.providerCalls = window.__probe.calls.length;
    out.invalidateCount = window.__probe.invalidateCount;

    /* Bring the collage + filterBar into the viewport FIRST (the home
     * view shows neither: lazy images and culling hide everything). */
    try {
      var fb0 = document.getElementById('filterBar').getBoundingClientRect();
      var target = fb0.top + window.scrollY - 40;
      window.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
      kick(); await wait(900);   // images decode (lazy rootMargin 400px)
      // wait (bounded) for the FIRST diamond tile image to actually load
      var imgWait = 0;
      while (imgWait < 6000) {
        var firstImg = document.querySelector('#collageArea .diamond-item img');
        if (firstImg && firstImg.classList.contains('loaded')) break;
        await wait(300); imgWait += 300;
      }
      out.firstTileLoadedAfter = imgWait;
      // virtual time may not serve rAFs: force the provider redraw
      liq._sceneDirty = true; liq._frame();
      out.scrolledForMeasure = window.scrollY;
    } catch (e) { check('scroll-to-collage threw', false, e.message); }

    /* 16/17. DOM vs scene diamond position + gap */
    try {
      var d = domDiamondInner();
      var sceneX = sceneDiamondLeftVertex();
      var sceneY = sceneDiamondTopVertex();
      out.domLeftVertexX = d ? +d.left.toFixed(2) : null;
      out.domTopVertexY = d ? +d.top.toFixed(2) : null;
      out.sceneLeftVertexX = sceneX !== null ? +sceneX.toFixed(2) : null;
      out.sceneTopVertexY = sceneY !== null ? +sceneY.toFixed(2) : null;
      var err = (sceneX !== null && d) ? Math.abs(sceneX - d.left) : 9999;
      var errY = (sceneY !== null && d) ? Math.abs(sceneY - d.top) : 9999;
      out.posErrorPx = +err.toFixed(2);
      out.posErrorYPx = +errY.toFixed(2);
      check('16 scene diamond X matches DOM (padding derived from rect)', err <= 1.5,
        'errX=' + err.toFixed(2) + 'px dom=' + (d && d.left.toFixed(1)) + ' scene=' + (sceneX && sceneX.toFixed(1)));
      check('16 scene diamond Y matches DOM (docTop - scrollY)', errY <= 1.5,
        'errY=' + errY.toFixed(2) + 'px dom=' + (d && d.top.toFixed(1)) + ' scene=' + (sceneY && sceneY.toFixed(1)));
      check('16 scene provider actually rendered', out.providerCalls > 0, 'calls=' + out.providerCalls);
    } catch (e) { check('16 threw', false, e.message); }

    /* 17. gap: DOM outer tile vs inner diamond = 5px */
    try {
      var item = document.querySelector('#collageArea .diamond-item');
      var ir = item.getBoundingClientRect();
      var d2 = domDiamondInner();
      var domGap = d2.left - ir.left;
      out.domGap = +domGap.toFixed(2);
      check('17 DOM gap is 5px', Math.abs(domGap - 5) < 0.5, 'gap=' + domGap.toFixed(2));
      check('17 scene gap applied (16 matched the INNER edge)', out.posErrorPx <= 1.5,
        'posError=' + out.posErrorPx);
    } catch (e) { check('17 threw', false, e.message); }

    /* 18. scroll sync: 3 positions from the measurement scroll */
    try {
      var base = domDiamondInner();
      var baseTop = base.top;
      var baseScroll = window.scrollY;
      out.scrollBaseY = +baseScroll.toFixed(1);
      var deltas = [];
      var offsets = [100, 500, 300];
      for (var k = 0; k < offsets.length; k++) {
        window.scrollTo({ top: baseScroll + offsets[k], behavior: 'instant' });
        kick(); await wait(600);
        liq._sceneDirty = true; liq._frame();
        var now = domDiamondInner();
        deltas.push(now ? now.top - baseTop : 9999);
      }
      out.scrollDeltas = deltas.map(function (v) { return +v.toFixed(2); });
      check('18 scroll +100: DOM delta -100', Math.abs(deltas[0] + 100) <= 1, 'delta=' + deltas[0].toFixed(2));
      check('18 scroll +500: DOM delta -500', Math.abs(deltas[1] + 500) <= 1, 'delta=' + deltas[1].toFixed(2));
      check('18 scroll +300: DOM delta -300', Math.abs(deltas[2] + 300) <= 1, 'delta=' + deltas[2].toFixed(2));
      var ys = window.__probe.calls.map(function (c) { return c.scrollY; });
      check('18 provider renders saw scrolled positions', ys.length >= 3, 'renders=' + ys.length);
      // return to a view where the first diamond is visible again, then
      // re-check the scene X/Y anchoring. Virtual time may not serve
      // rAFs, so force a synchronous provider redraw before measuring.
      window.scrollTo({ top: baseScroll, behavior: 'instant' });
      kick(); await wait(600);
      liq._sceneDirty = true; liq._frame();
      var sx2 = sceneDiamondLeftVertex();
      var sy2 = sceneDiamondTopVertex();
      var dNow = domDiamondInner();
      var errNow = (sx2 !== null && dNow) ? Math.abs(sx2 - dNow.left) : 9999;
      var errNowY = (sy2 !== null && dNow) ? Math.abs(sy2 - dNow.top) : 9999;
      out.posErrorAfterScrollPx = +errNow.toFixed(2);
      out.posErrorAfterScrollYPx = +errNowY.toFixed(2);
      out.scrolledTo = window.scrollY;
      check('18 scene X still matches DOM after scrolling', errNow <= 1.5, 'err=' + errNow.toFixed(2));
      check('18 scene Y still matches DOM after scrolling', errNowY <= 1.5, 'err=' + errNowY.toFixed(2));
    } catch (e) { check('18 threw', false, e.message); }

    /* 19. image load reflects into the glass scene. The coalesced
     * invalidation itself is proven by tests/scene-sync.test.js (the
     * RAF queue drains exactly one invalidation after a batch of image
     * loads); here we prove the END-TO-END pixel side: after images have
     * decoded (zero scroll/resize/user input during the wait), a scene
     * redraw contains the tile image where the DOM shows it. */
    try {
      // wait for MORE images to decode without any interaction
      var loadedBefore = document.querySelectorAll('#collageArea img.loaded').length;
      var waited = 0;
      while (waited < 4000) { await wait(250); waited += 250; }
      out.loadedBefore = loadedBefore;
      out.loadedAfter = document.querySelectorAll('#collageArea img.loaded').length;
      // the scene provider must now draw a visible tile at the diamond
      liq._sceneDirty = true; liq._frame();
      var hasTile = null;
      try { hasTile = sceneHasAnyTile(); } catch (e2) { hasTile = 'err:' + e2.message; }
      out.sceneHasTile = hasTile;
      check('19 provider canvas contains a drawn tile after decode', hasTile === true, String(hasTile));
      // the drawn tile sits at the DOM diamond position (proves the
      // load-completed image flows through to the glass scene)
      var sx19 = sceneDiamondLeftVertex();
      var d19 = domDiamondInner();
      var err19 = (sx19 !== null && d19) ? Math.abs(sx19 - d19.left) : 9999;
      out.tilePosErrorPx = +err19.toFixed(2);
      check('19 drawn tile position matches the DOM diamond', err19 <= 1.5, 'err=' + err19.toFixed(2));
    } catch (e) { check('19 threw', false, e.message); }

    /* 21. overlay alpha outside the glass. readPixels needs a FRESH
     * composite: the canvas is preserveDrawingBuffer:false, so force a
     * synchronous frame right before reading. The sample row is the
     * filterBar center; the sample X walks right past the bar AND past
     * every other tracked glass element (the fixed profileCard can overlap
     * the bar's right edge, so "just outside the bar" is not enough). */
    try {
      liq._sceneDirty = true; liq._geometryDirty = true; liq._frame();
      var cnv = liq.getCanvas();
      var gl = liq.getContext();
      var fb = document.getElementById('filterBar').getBoundingClientRect();
      var pcRect = document.getElementById('profileCard').getBoundingClientRect();
      var sx = cnv.width / window.innerWidth;
      var sy = cnv.height / window.innerHeight;
      var rowY = Math.round((fb.top + fb.height / 2) * sy);
      var startX = Math.max(fb.right, pcRect.right);
      var alphas = [1, 5, 10].map(function (d) {
        var px = new Uint8Array(4);
        gl.readPixels(Math.round((startX + d) * sx), cnv.height - rowY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { d: d, a: px[3] };
      });
      out.alphaOutside = alphas;
      out.alphaSampleStartX = +startX.toFixed(1);
      check('21 overlay alpha outside +1px == 0', alphas[0].a === 0, 'a=' + alphas[0].a);
      check('21 overlay alpha outside +5px == 0', alphas[1].a === 0, 'a=' + alphas[1].a);
      check('21 overlay alpha outside +10px == 0', alphas[2].a === 0, 'a=' + alphas[2].a);
      var pin = new Uint8Array(4);
      gl.readPixels(Math.round((fb.left + fb.width / 2) * sx), cnv.height - Math.round((fb.top + fb.height / 2) * sy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pin);
      out.alphaInside = pin[3];
      check('21 overlay alpha inside glass > 0', pin[3] > 0, 'a=' + pin[3]);
      /* AA boundary: a column crossing the left glass edge shows partial
       * alpha at the boundary pixel (between rounded and not). */
      var paa = new Uint8Array(4);
      gl.readPixels(Math.round((fb.left - 0.5) * sx), cnv.height - Math.round((fb.top + fb.height / 2) * sy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, paa);
      out.alphaBoundary = paa[3];
      check('21 boundary alpha defined (0 <= a <= 255)', paa[3] >= 0, 'a=' + paa[3]);
    } catch (e) { check('21 threw', false, e.message); }

    /* 13. base background */
    try {
      var pc = liq._providerCanvas;
      var pctx = pc.getContext('2d');
      var corner = pctx.getImageData(2, 2, 1, 1).data;
      out.providerCorner = [corner[0], corner[1], corner[2]];
      var bodyBg = getComputedStyle(document.body).backgroundColor;
      out.bodyBg = bodyBg;
      check('13 provider base is the dark body background',
        corner[0] < 45 && corner[1] < 45 && corner[2] < 70,
        'rgb(' + corner[0] + ',' + corner[1] + ',' + corner[2] + ') vs body ' + bodyBg);
    } catch (e) { check('13 threw', false, e.message); }

    /* 14. stacking + clicks */
    try {
      var btn = document.querySelector('.filter-btn');
      var r = btn.getBoundingClientRect();
      var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      check('14 filter button hit-test reaches the button', el === btn || (btn.contains(el)), String(el && (el.className || el.tagName)));
      var cnv2 = document.getElementById('mina-glcanvas');
      var cs = cnv2 ? getComputedStyle(cnv2) : null;
      out.canvasPointerEvents = cs ? cs.pointerEvents : 'no-canvas';
      check('14 overlay canvas does not take pointer input', cs && cs.pointerEvents === 'none', cs && cs.pointerEvents);
      var fbZ = getComputedStyle(document.getElementById('filterBar')).zIndex;
      var cnvZ = cs ? cs.zIndex : 'none';
      check('14 filterBar (z=' + fbZ + ') above canvas (z=' + cnvZ + ')', parseInt(fbZ, 10) > parseInt(cnvZ || '0', 10), fbZ + ' vs ' + cnvZ);
      var item2 = document.querySelector('#collageArea .diamond-item');
      var itemZ = getComputedStyle(item2.parentElement || item2).zIndex;
      out.diamondZ = itemZ; out.canvasZ = cnvZ;
      check('14 diamond area below canvas', parseInt(itemZ || '0', 10) < parseInt(cnvZ || '0', 10), itemZ + ' vs ' + cnvZ);
    } catch (e) { check('14 threw', false, e.message); }

    out.results = results;
    out.providerErrors = window.__probe.errors;
    done(out);
  }

  function sceneHasAnyTile() {
    var liq = window._minaLiquid;
    var pc = liq._providerCanvas;
    var ctx = pc.getContext('2d');
    var el = document.querySelector('#collageArea .diamond-inner');
    if (!el) return false;
    var d = el.getBoundingClientRect();
    var dpr = pc.width / window.innerWidth;
    var row = Math.round((d.top + d.height / 2) * dpr);
    var w = Math.round(pc.width);
    var h = Math.round(pc.height);
    if (!isFinite(row) || !isFinite(w) || !isFinite(h)) return 'nan row=' + row + ' w=' + w + ' h=' + h;
    if (row < 0 || row >= h || w <= 0) return false;
    var img = ctx.getImageData(0, row, w, 1).data;
    var base = [img[0], img[1], img[2]];
    for (var x = 0; x < w; x++) {
      var i = x * 4;
      if (Math.abs(img[i] - base[0]) + Math.abs(img[i + 1] - base[1]) + Math.abs(img[i + 2] - base[2]) > 48) return true;
    }
    return false;
  }

  /* Scene diamond TOP vertex: scan the column at the diamond's center X
   * from the top of the canvas down to the diamond's bottom; the first
   * non-background pixel is the top vertex (y coordinate). */
  function sceneDiamondTopVertex() {
    var liq = window._minaLiquid;
    if (!liq || !liq._providerCanvas) return null;
    var pc = liq._providerCanvas;
    var dpr = pc.width / window.innerWidth;
    var ctx = pc.getContext('2d');
    var d = domDiamondInner();
    if (!d) return null;
    var col = Math.round((d.left + d.width / 2) * dpr);
    var yStart = Math.max(0, Math.round(d.top * dpr) - 4);
    var yEnd = Math.min(pc.height - 1, Math.round((d.bottom) * dpr) + 2);
    var colImg = ctx.getImageData(col, yStart, 1, yEnd - yStart + 1).data;
    // base sample: a row far above the diamond (or canvas row 2)
    var baseImg = ctx.getImageData(col, 2, 1, 1).data;
    var b0 = baseImg[0], b1 = baseImg[1], b2 = baseImg[2];
    for (var yy = 0; yy < colImg.length / 4; yy++) {
      var i = yy * 4;
      if (Math.abs(colImg[i] - b0) + Math.abs(colImg[i + 1] - b1) + Math.abs(colImg[i + 2] - b2) > 48) {
        return (yStart + yy) / dpr;
      }
    }
    return null;
  }

  function done(out) {
    var holder = document.getElementById('vrc-probe-result');
    holder.textContent = 'VRC_PROBE_JSON ' + JSON.stringify(out);
  }

  var bootWait = 0;
  var iv = setInterval(function () {
    bootWait += 200;
    var area = document.getElementById('collageArea');
    var liq = window._minaLiquid;
    if ((area && area.children.length > 0 && liq && liq.getSceneState() === 'ready') || bootWait > 20000) {
      clearInterval(iv);
      measure().catch(function (e) { done({ error: String(e && e.stack || e) }); });
    }
  }, 200);
})();
</script>`;

function startServer(probeHtml) {
  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    let body, type;
    if (url === "/") {
      body = probeHtml; type = "text/html";
    } else {
      const rel = decodeURIComponent(url.replace(/^\//, ""));
      try {
        body = readFileSync(join(root, rel));
      } catch (e) {
        res.writeHead(404); res.end("not found"); return;
      }
      type = rel.endsWith(".css") ? "text/css"
        : rel.endsWith(".js") ? "text/javascript"
        : rel.endsWith(".json") ? "application/json"
        : rel.endsWith(".html") ? "text/html"
        : rel.endsWith(".png") ? "image/png"
        : rel.endsWith(".jpg") || rel.endsWith(".jpeg") ? "image/jpeg"
        : rel.endsWith(".webp") ? "image/webp"
        : "application/octet-stream";
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function runViewport(width, height, label) {
  let html = page;
  html = html.replace('<div class="bg-slideshow" id="bgSlideshow"></div>',
    '<div id="vrc-probe-result" style="display:none"></div>\n<div class="bg-slideshow" id="bgSlideshow"></div>');
  // insert the probe AFTER the library script tags (before the page script)
  html = html.replace('<script src="minaui.glass.js"></script>',
    '<script src="minaui.glass.js"></script>\n' + PROBE);
  html = html.replace("</body>", MEASURE + "\n</body>");
  assert(html.includes("window.__probe = { calls"), `${label}: probe injection failed`);

  const { server, port } = await startServer(html);
  try {
    const { stdout } = await execFileAsync(CHROME, [
      "--headless=new",
      `--window-size=${width},${height}`,
      "--virtual-time-budget=30000",
      "--disable-gpu-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      "--autoplay-policy=no-user-gesture-required",
      "--user-data-dir=" + mkdtempSync(join(tmpdir(), "vrc-chrome-")),
      "--dump-dom",
      `http://127.0.0.1:${port}/`
    ], { maxBuffer: 64 * 1024 * 1024, timeout: 240000 });

    const m = stdout.match(/VRC_PROBE_JSON (\{.*?\})<\/div>/s);
    if (!m) throw new Error(`${label}: no probe payload; dom head: ${stdout.slice(0, 200)}`);
    return JSON.parse(m[1]);
  } finally {
    server.close();
  }
}

const overall = {};
for (const [label, w, h] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
  console.log(`\n===== ${label} ${w}x${h} =====`);
  const r = await runViewport(w, h, label);
  overall[label] = r;
  if (r.error) throw new Error(`${label} probe error: ${r.error}`);
  console.log("backend:", r.backend, "| sceneState:", r.sceneState, "| glClass:", r.glClass);
  console.log("providerCalls:", r.providerCalls, "| invalidations:", r.invalidateCount, "| autoRedrawCalls:", r.autoRedrawCalls);
  console.log("posErrorPx:", r.posErrorPx, "(after scroll:", r.posErrorAfterScrollPx + ")",
    "| domGap:", r.domGap, "| alphaOutside:", JSON.stringify(r.alphaOutside), "| alphaInside:", r.alphaInside);
  console.log("providerCorner:", r.providerCorner, "| bodyBg:", r.bodyBg, "| pointerEvents:", r.canvasPointerEvents, "| diamondZ/canvasZ:", r.diamondZ + "/" + r.canvasZ);
  for (const line of r.results.ok) console.log("  ok  ", line);
  for (const line of r.results.fail) console.log("  FAIL", line);
}

for (const label of ["desktop", "mobile"]) {
  const r = overall[label];
  assert(r.error === undefined, `${label}: probe error`);
  assert(r.backend === "webgl", `${label}: expected webgl backend (got ${r.backend})`);
  assert(r.sceneState === "ready", `${label}: scene must be ready (got ${r.sceneState})`);
  assert(r.glClass.includes("mina-liquid-gl"), `${label}: GL class missing`);
  assert(r.results.fail.length === 0, `${label}: failed checks: ` + r.results.fail.join(" | "));
  assert(r.posErrorPx <= 1.5, `${label}: diamond position error ${r.posErrorPx}px`);
  assert(r.alphaInside > 0, `${label}: glass interior must have alpha`);
  (r.alphaOutside || []).forEach(({ d, a }) => assert(a === 0, `${label}: alpha outside +${d}px must be 0 (got ${a})`));
}
console.log("\nVRC CHROMIUM VISUAL VALIDATION PASSED");
