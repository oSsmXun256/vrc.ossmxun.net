// Source-contract tests for viewport css-background handling.
'use strict';
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('minaui.glass.js', 'utf8');
const styles = {
    backgroundImage: 'url("/bg.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
};

const sandbox = {
    console: { warn() {}, error() {}, info() {} },
    module: { exports: {} },
    setTimeout, clearTimeout,
    innerWidth: 1280,
    innerHeight: 900,
    navigator: { userAgent: 'Chrome/126.0', platform: '', maxTouchPoints: 0 },
    matchMedia() { return { matches: false }; },
    CSS: { supports() { return true; } },
    WebGL2RenderingContext: function () {},
    getComputedStyle() { return styles; },
    Image: function FakeImage() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
new vm.Script(source, { filename: 'minaui.glass.js' }).runInContext(sandbox);
const MinaLiquid = sandbox.module.exports.MinaLiquid;

let failures = 0;
function check(name, condition, detail) {
    if (condition) console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`);
    else { failures++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

function probe(rect) {
    let failure = null;
    let adopted = false;
    const liquid = Object.create(MinaLiquid.prototype);
    liquid.destroyed = false;
    liquid._sourceToken = {};
    liquid._sceneFailed = message => { failure = message; };
    liquid._adoptSourceElement = () => { adopted = true; };
    const target = { getBoundingClientRect() { return rect; } };
    liquid._setupCssBackground({ target });
    return { failure, adopted, info: liquid._cssBgInfo };
}

const rejected = probe({ left: 40, top: 120, width: 800, height: 500 });
check('css-background rejects arbitrary element-sized target',
    rejected.failure === 'css-background: target must match the viewport (within 1 CSS px)' && !rejected.adopted,
    rejected.failure || 'no failure');

const accepted = probe({ left: 0.5, top: -0.5, width: 1280.5, height: 899.5 });
check('css-background accepts viewport-sized target within 1 CSS px',
    accepted.failure === null && accepted.info && accepted.info.sizeInfo.mode === 'cover',
    accepted.failure || 'accepted');

console.log(failures === 0 ? '\nALL SOURCE-CONTRACT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
