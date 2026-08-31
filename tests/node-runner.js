/**
 * GUC Schedule Matrix — Headless Test Runner
 *
 * Loads the exact production scripts (shared-constants.js, content.js,
 * popup/popup.js) plus the shared fixtures and assertion suite into a
 * jsdom window, then runs the same runGucParserTests() the browser
 * harness button runs. Exits non-zero when any assertion fails.
 *
 *   npm install   (once; dev-only — jsdom is not used by the extension)
 *   npm test
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');

// jsdom does not implement innerText (it renders textContent only).
// content.js reads innerText for every cell, so install a block-aware
// polyfill BEFORE any production script runs: block elements (table, tr,
// td, ...) contribute surrounding newlines — mirroring how real browsers
// serialize those boxes — while <script>/<style> and SVG scaffolding
// (the extension-injected kind present in the real portal paste)
// contribute nothing.
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.chrome = {
      storage: { local: { get: (keys, cb) => cb({}), set: () => {} } },
      tabs: { query: async () => [], sendMessage: () => {}, create: () => {} },
      runtime: { lastError: null }
    };

    // jsdom does not implement the Encoding standard; popup.js's PDF
    // builder (buildPdfFromJpeg) needs both.
    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;

    const BLOCK = new Set([
      'ADDRESS', 'ARTICLE', 'BLOCKQUOTE', 'DIV', 'DL', 'DT', 'DD',
      'FIELDSET', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
      'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY',
      'THEAD', 'TFOOT', 'TR', 'TD', 'TH', 'UL'
    ]);
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE']);

    function renderText(el) {
      let out = '';
      for (const node of el.childNodes) {
        if (node.nodeType === 3) { out += node.nodeValue; continue; }
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'BR') { out += '\n'; continue; }
        if (SKIP.has(node.tagName)) continue;
        if (node.namespaceURI === 'http://www.w3.org/2000/svg') continue;
        const inner = renderText(node);
        if (!inner) continue;
        out += BLOCK.has(node.tagName) ? '\n' + inner + '\n' : inner;
      }
      return out;
    }

    Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() { return renderText(this); }
    });
  }
});

const { window } = dom;

// Same script order as test-harness.html. The files are concatenated into
// ONE eval call: separate indirect evals each get their own lexical
// environment (const/let don't persist between them), while sequential
// <script> tags in a browser share the global one — concatenation
// reproduces the browser behavior.
const scripts = [
  'shared-constants.js',
  'content.js',
  'popup/popup.js',
  'tests/fixtures.js',
  'tests/run-tests.js'
];
const bundle = scripts.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
window.eval(bundle);

const { results, parseResult } = window.runGucParserTests();

for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} — ${r.label}`);
}
const failCount = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failCount}/${results.length} assertions passed`);

if (!parseResult.success) {
  console.log('\nParser error:', parseResult.error);
}

process.exit(failCount === 0 && parseResult.success ? 0 : 1);
