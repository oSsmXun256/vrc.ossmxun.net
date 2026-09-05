// Layout calculation test: extracts planDiamondLayout from index.html and
// verifies geometry for the required viewports.
'use strict';
const fs = require('fs');
const path = process.argv[2] || 'index.html';
const html = fs.readFileSync(path, 'utf8');
const m = html.match(/\/\* @gallery-layout:start \*\/([\s\S]*?)\/\* @gallery-layout:end \*\//);
if (!m) { console.error('layout markers not found'); process.exit(1); }
(0, eval)(m[1]); // indirect eval: define planDiamondLayout globally

const GAP = 5;
const PADDING_MOBILE = 32; // scroll-area padding <=640px (16px x2)
const PADDING_DESKTOP = 96; // 48px x2
const PHOTO_COUNT = (() => {
    const list = JSON.parse(fs.readFileSync('memories/list.json', 'utf8'));
    return list.length;
})();

let failures = 0;
function check(name, cond, detail) {
    if (cond) console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`);
    else { failures++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const VIEWPORTS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

console.log(`photos in list.json: ${PHOTO_COUNT}\n`);

for (const vp of VIEWPORTS) {
    const padding = vp <= 640 ? PADDING_MOBILE : PADDING_DESKTOP;
    const W = vp - padding; // collageArea.clientWidth
    const plan = planDiamondLayout(W, PHOTO_COUNT);
    const placements = plan.placements;

    console.log(`viewport ${vp}px (area ${W}px): cols=${plan.cols} tile=${plan.tile.toFixed(1)}px placements=${placements.length}`);

    check('all photos placed', placements.length === PHOTO_COUNT, `${placements.length}/${PHOTO_COUNT}`);

    // container overflow: no tile may exceed [0, W] horizontally
    let maxRight = 0, minLeft = Infinity;
    let overflow = false;
    for (const p of placements) {
        if (p.left < -0.01 || p.left + p.size > W + 0.01) overflow = true;
        maxRight = Math.max(maxRight, p.left + p.size);
        minLeft = Math.min(minLeft, p.left);
    }
    check('no horizontal overflow', !overflow);

    // right-side gap must be small (lattice rounding only, < half a unit tile)
    const rightGap = W - maxRight;
    const leftGap = minLeft;
    check('no large right-only gap', rightGap <= plan.half + 0.01, `right gap=${rightGap.toFixed(1)}px`);
    check('left/right margins balanced', Math.abs(rightGap - leftGap) <= plan.tile / 2 + 0.01,
        `left=${leftGap.toFixed(1)}px right=${rightGap.toFixed(1)}px`);

    // tile size sanity: not absurdly small on any supported width
    check('tile not too small', plan.tile >= 120, `min tile=${plan.tile.toFixed(1)}px`);

    // no overlapping DIAMONDS: tiles hold inscribed diamonds (L1 balls).
    // Bounding boxes legitimately touch at corners; use the L1 metric:
    // diamonds overlap iff |dx| + |dy| < r1 + r2 (epsilon for float error).
    let overlap = false;
    const centers = placements.map(p => ({
        cx: p.left + p.size / 2,
        cy: p.top + p.size / 2,
        r: p.size / 2
    }));
    const EPS = 0.01;
    for (let i = 0; i < centers.length && !overlap; i++) {
        for (let j = i + 1; j < centers.length; j++) {
            const a = centers[i], b = centers[j];
            if (Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy) < a.r + b.r - EPS) { overlap = true; break; }
        }
    }
    check('no tile overlaps', !overlap);
}

// Filter subsets still lay out correctly (e.g., year filter)
console.log('\nsubset checks:');
for (const n of [1, 5, 20, 68]) {
    const plan = planDiamondLayout(1184, n);
    check(`${n} photos @1280`, plan.placements.length === n && plan.height > 0 || (n === 0),
        `placed=${plan.placements.length} height=${plan.height.toFixed(0)}px`);
}

// Resize stability: same width → identical plan (idempotent)
const a = planDiamondLayout(1184, PHOTO_COUNT);
const b = planDiamondLayout(1184, PHOTO_COUNT);
check('deterministic for same width', JSON.stringify(a) === JSON.stringify(b));

// Node reuse mapping: relayout keeps count equal so nodes can be reused
const narrow = planDiamondLayout(358, PHOTO_COUNT);
const wide = planDiamondLayout(1184, PHOTO_COUNT);
check('placement count stable across widths (node reuse)', narrow.placements.length === wide.placements.length);

// Sweep every plausible area width: no overflow, no one-sided gap, no diamond
// overlap, all photos placed. Catches float-precision edge cases.
console.log('\nwidth sweep 240..2000:');
let sweepFail = 0;
for (let w = 240; w <= 2000; w++) {
    const plan = planDiamondLayout(w, PHOTO_COUNT);
    let maxRight = 0, bad = '';
    if (plan.placements.length !== PHOTO_COUNT) bad = 'count';
    for (const p of plan.placements) {
        if (p.left < -0.01 || p.left + p.size > w + 0.01) { bad = 'overflow'; break; }
        maxRight = Math.max(maxRight, p.left + p.size);
    }
    if (!bad && (w - maxRight) > plan.half + 0.01) bad = 'right-gap=' + (w - maxRight).toFixed(1);
    // L1 diamond overlap spot check (sampled)
    if (!bad) {
        for (let i = 0; i < plan.placements.length && !bad; i++) {
            const a = plan.placements[i];
            for (let j = i + 1; j < plan.placements.length; j++) {
                const b = plan.placements[j];
                const dx = Math.abs((a.left + a.size / 2) - (b.left + b.size / 2));
                const dy = Math.abs((a.top + a.size / 2) - (b.top + b.size / 2));
                if (dx + dy < (a.size + b.size) / 2 - 0.01) { bad = 'overlap'; break; }
            }
        }
    }
    if (bad) { sweepFail++; console.log(`  FAIL w=${w}: ${bad}`); }
}
check('sweep all widths', sweepFail === 0, `${2000 - 240 + 1 - sweepFail}/${2000 - 240 + 1} widths OK`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
