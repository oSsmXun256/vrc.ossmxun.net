// Static backend-selection test for minaui.glass.js (no real browser).
// Stubs browser globals, loads the module (module.exports path, window
// aliased to the sandbox), and verifies detectBackend / normalizeBackend
// decisions for each environment class.
'use strict';
const fs = require('fs');
const vm = require('vm');
const GLASS_SRC = fs.readFileSync('minaui.glass.js', 'utf8');

function loadMinaGlass(env) {
    const sandbox = {
        console: { warn() {}, error() {}, info() {} },
        module: { exports: {} },
        setTimeout, clearTimeout,
        navigator: {
            userAgent: env.ua || '',
            platform: env.platform || '',
            maxTouchPoints: env.maxTouchPoints || 0
        },
        matchMedia: function (q) {
            return { matches: !!env.coarse && q.indexOf('pointer') !== -1 };
        },
        CSS: { supports: function () { return env.blur !== false; } }
    };
    if (env.webgl2 === false) {
        // no WebGL2 host binding at all (not even on window)
    } else {
        sandbox.WebGL2RenderingContext = function () {};
    }
    sandbox.window = sandbox;   // window === global sandbox (browser-like)
    vm.createContext(sandbox);
    new vm.Script(GLASS_SRC, { filename: 'minaui.glass.js' }).runInContext(sandbox);
    const glass = sandbox.module.exports.MinaGlass;
    const liquid = sandbox.module.exports.MinaLiquid;
    return {
        detect: glass.detectBackend(env.quality),
        normBackend: liquid.normalizeBackend(env.backend)
    };
}

let failures = 0;
function check(name, actual, expected) {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}: got '${actual}'${ok ? '' : `, expected '${expected}'`}`);
}

const cases = [
    { name: 'iOS Safari (auto)', env: { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }, expect: 'native' },
    { name: 'iPadOS Safari (auto)', env: { ua: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile Safari/16.0', platform: 'MacIntel', maxTouchPoints: 5 }, expect: 'native' },
    { name: 'macOS Safari (auto)', env: { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15' }, expect: 'native' },
    { name: 'Desktop Chrome (auto)', env: { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }, expect: 'webgl' },
    { name: 'Desktop Firefox (auto)', env: { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0' }, expect: 'webgl' },
    // V3: quality no longer forces the backend (quality is a WebGL tier;
    // environment problems fall back via CSS frost). Chrome desktop keeps webgl.
    { name: 'quality tier never forces native (V3)', env: { ua: 'Chrome/126.0', quality: 'performance' }, expect: 'webgl' },
    { name: 'coarse pointer prefers native', env: { ua: 'Chrome/126.0 Mobile Android', coarse: true }, expect: 'native' },
    { name: 'no WebGL2 -> native', env: { ua: 'Chrome/126.0', webgl2: false }, expect: 'native' },
    { name: 'explicit webgl preference kept', env: { ua: 'Chrome/126.0', backend: 'webgl' }, expect: 'webgl', normExpect: 'webgl' },
];

console.log('backend selection:');
for (const c of cases) {
    const r = loadMinaGlass(c.env);
    check(c.name, r.detect, c.expect);
}
console.log('\nnormalize:');
check('undefined -> auto', loadMinaGlass({}).normBackend, 'auto');

console.log(failures === 0 ? '\nALL BACKEND CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
