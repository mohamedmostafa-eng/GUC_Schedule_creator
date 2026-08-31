/**
 * GUC Schedule Matrix — Test Fixture Markup (single source of truth)
 *
 * Loaded by tests/test-harness.html (browser) and tests/node-runner.js
 * (jsdom) so both run the exact same markup. Two classes of fixture live
 * here, deliberately kept apart:
 *
 *  1. SYNTHETIC cells — hand-built shapes for parser-machinery coverage
 *     (nested-table dedup, rowspan, colspan period mapping, all German
 *     levels / elective tracks, a compound cross-faculty tag). These do
 *     NOT claim to mirror the real portal; they exist to pin down the
 *     extraction machinery.
 *  2. REAL-PORTAL cells — transcribed from outerHTML copied out of the
 *     live schedule page (the <font> tags, width attributes, per-group
 *     stacked rows and space-separated 5-part group tags such as
 *     "3 MET III 3G T019" are exactly as pasted). Anything in this class
 *     must stay faithful to a real paste; if the portal changes, re-copy
 *     it — don't edit from memory.
 *
 * The Thursday row carries the real-portal cells: one period cell holding
 * nine stacked DE303 tutorial rows (one per group, each with its own room
 * — the shape that decides whether group filtering isolates the right
 * row), and one cohort lecture row.
 */
const GUC_TEST_FIXTURE_HTML = `
<table class="mock" id="mockScheduleTable">
  <tr>
    <th>Day</th>
    <th>First Period</th>
    <th>Second Period</th>
    <th>Third Period</th>
    <th>Fourth Period</th>
    <th>Fifth Period</th>
  </tr>
  <tr>
    <td>Saturday</td>
    <td>CSEN401 Lecture H12 (same class as before)</td>
    <td>Free</td>
    <td>3 IET-8 &amp; MET11 SM T011 C4.321</td>
    <td>DE101 T001 B1.101</td>
    <td>Free</td>
  </tr>
  <tr>
    <td>Sunday</td>
    <td>CSEN401 T011 Tutorial C3.201</td>
    <td>MATH301 Lecture H5</td>
    <td>Free</td>
    <td>DE202 T021 B2.104</td>
    <td>AE 301 T041 B3.110</td>
  </tr>
  <tr>
    <td>Monday</td>
    <td>Free</td>
    <td>CSEN401 P011 Lab C4.321</td>
    <td>CPS402 T031 H8</td>
    <td>DE303 T012 B1.102</td>
    <td>AS 210 T051 B3.111</td>
  </tr>
  <tr>
    <td>Tuesday</td>
    <td colspan="2">
      <table class="nested">
        <tr><td>ELCT501 Lecture H16</td></tr>
        <tr><td>ELCT501 Lecture H17</td></tr>
      </table>
    </td>
    <td>DE404 T081 B1.103</td>
    <td>RPW 110 T061 B3.112</td>
    <td>Free</td>
  </tr>
  <tr>
    <td>Wednesday</td>
    <td rowspan="2">ENME503 Lab H9</td>
    <td>Free</td>
    <td>Free</td>
    <td>Free</td>
    <td>Free</td>
  </tr>
  <tr>
    <td>Thursday</td>
    <td>
      <!-- REAL-PORTAL cell: nine stacked German tutorial rows, one per
           group, transcribed from pasted schedule-page outerHTML. -->
      <table class="nested">
        <tr data-noise="1">
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C2.105</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T016</font></td>
        </tr>
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C2.106</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T017</font></td>
        </tr>
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C2.107</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T018</font></td>
        </tr>
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C2.108</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T019</font></td>
        </tr>
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C2.109</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T020</font></td>
        </tr>
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C2.110</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T021</font></td>
        </tr>
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C2.111</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T022</font></td>
        </tr>
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C2.112</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T023</font></td>
        </tr>
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">DE303 Tut</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">C3.201</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G T024</font></td>
        </tr>
      </table>
    </td>
    <td>
      <!-- REAL-PORTAL cell: cohort lecture row — tag column carries the
           5-part tag WITHOUT a T-number, so it must not become a group. -->
      <table class="nested">
        <tr>
          <td width="55"><font face="Arial, Helvetica, sans-serif" size="1">MATH301 Lecture</font></td>
          <td width="40"><font face="Arial, Helvetica, sans-serif" size="1">H5</font></td>
          <td width="20"><font face="Arial, Helvetica, sans-serif" size="1">3 MET III 3G</font></td>
        </tr>
      </table>
    </td>
    <td>Free</td>
    <td>Free</td>
  </tr>
</table>
`;

// Browser extensions (svgjs-based ones, e.g. color pickers) inject hidden
// <svg> scaffolding elements into table rows on the live portal — the real
// outerHTML paste contained two of these inside the group row. Reproduce
// that inside every <tr data-noise> so the tests prove the parser ignores
// them.
function injectSvgNoiseIntoFixture(rootEl) {
  const doc = rootEl.ownerDocument;
  rootEl.querySelectorAll('tr[data-noise]').forEach(tr => {
    for (let i = 0; i < 2; i++) {
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '2');
      svg.setAttribute('height', '0');
      svg.setAttribute('style', 'overflow: hidden; top: -100%; left: -100%; position: absolute; opacity: 0;');
      const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const polyline = doc.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '0,0');
      const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M0 0 ');
      svg.appendChild(defs);
      svg.appendChild(polyline);
      svg.appendChild(path);
      tr.appendChild(svg);
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GUC_TEST_FIXTURE_HTML, injectSvgNoiseIntoFixture };
}
