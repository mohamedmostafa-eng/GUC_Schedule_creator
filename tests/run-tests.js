/**
 * GUC Schedule Matrix — Parser & Filter Test Suite
 *
 * Runs against the REAL content.js (parseGUCMatrixDOM) and the REAL
 * popup.js filter engine (computeFilteredSlots), using the fixture markup
 * from fixtures.js. Executed identically from:
 *   - tests/test-harness.html (button, results rendered on screen)
 *   - tests/node-runner.js   (headless jsdom, CI-style exit code)
 */

function runGucParserTests() {
  let root = document.getElementById('fixtureRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'fixtureRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = GUC_TEST_FIXTURE_HTML;
  injectSvgNoiseIntoFixture(root);

  const result = parseGUCMatrixDOM();
  const results = [];
  const assert = (cond, label) => results.push({ pass: !!cond, label });
  const slots = (result.success && result.data && result.data.slots) || [];

  // ---------- parser: synthetic machinery fixtures ----------
  assert(result.success, 'Parser ran successfully');
  assert(slots.some(s => s.day === 'Saturday'), 'Saturday slots are present (the original bug: Saturday was silently dropped)');
  assert(slots.filter(s => s.day === 'Tuesday' && s.period === 1).length === 2, 'Nested <table> cell yields exactly 2 slots (H16 + H17) at period 1, no GENERAL/junk double-extraction');
  assert(slots.filter(s => s.room === 'H16').length === 1 && slots.filter(s => s.room === 'H17').length === 1, 'H16/H17 each appear exactly once — colspan cell is not re-processed into extra periods');
  assert(slots.filter(s => s.day === 'Wednesday').length === 1, 'rowspan="2" cell registers exactly once, not duplicated per spanned row');
  assert(!slots.some(s => s.course === 'ELCT501' && s.group && s.group.category !== 'unknown'), 'Course code "ELCT501" (ends in T+digits) is not misread as its own group tag');
  const csenTut = slots.find(s => s.day === 'Sunday' && s.course === 'CSEN401');
  assert(csenTut && csenTut.group && csenTut.group.number === '011', 'CSEN401 trailing digit does not bleed into the group tag (T011, not 1T011)');

  const germanLevels = ['DE101', 'DE202', 'DE303', 'DE404'];
  germanLevels.forEach(lvl => {
    assert(slots.some(s => s.group && s.group.category === 'german' && s.group.level === lvl), 'German level ' + lvl + ' is classified correctly');
  });

  const electiveTracks = ['AE', 'AS', 'SM', 'CPS', 'RPW'];
  electiveTracks.forEach(tr => {
    assert(slots.some(s => s.group && s.group.category === 'elective' && s.group.track === tr), 'Elective track ' + tr + ' is classified correctly');
  });

  assert(result.data.availableGroups.german.length === 4, 'All 4 German levels registered in availableGroups.german');
  assert(result.data.availableGroups.electives.length === 5, 'All 5 elective tracks registered in availableGroups.electives');

  const csenLecture = slots.find(s => s.day === 'Saturday' && s.course === 'CSEN401' && s.type === 'Lecture');
  assert(csenLecture && csenLecture.isCohort === true, 'Plain colspan=1 lecture (CSEN401 H12) is flagged isCohort');
  const mathLecture = slots.find(s => s.day === 'Sunday' && s.course === 'MATH301');
  assert(mathLecture && mathLecture.isCohort === true, 'Plain colspan=1 lecture (MATH301 H5) is flagged isCohort');
  assert(slots.filter(s => s.course === 'ELCT501').every(s => s.isCohort === true), 'colspan=2 nested-table lectures (ELCT501) are flagged isCohort');
  assert(csenLecture && csenLecture.group === null, 'Lowercase prose near a course code does not produce a false elective/group match');

  // ---------- parser: real-portal markup (transcribed outerHTML) ----------
  const deRows = slots.filter(s => s.course === 'DE303' && s.day === 'Thursday' && s.period === 2);
  assert(deRows.length === 9, 'REAL PORTAL: all 9 stacked DE303 Tut rows in one period cell are extracted (course+room+group in sibling <td>s of one <tr>)');
  assert(new Set(deRows.map(r => r.room)).size === 9, 'REAL PORTAL: each group row keeps its own room (9 distinct rooms, no GENERAL/TBA junk rows)');
  const t016 = deRows.find(r => r.room === 'C2.105');
  assert(t016 && t016.groups.length === 1 && t016.groups[0].major === 'MET' && t016.groups[0].semester === '3' && t016.groups[0].number === '016' && t016.groups[0].category === 'tutorial',
    'REAL PORTAL: tag "3 MET III 3G T016" is captured whole — semester 3 + major MET survive (previously degraded to bare T016 with both lost) — and the injected svgjs extension noise in that row breaks nothing');
  assert(deRows.every(r => r.groups.length === 1 && r.groups[0].major === 'MET' && r.groups[0].semester === '3'),
    'REAL PORTAL: every one of the 9 rows resolves its tag with major+semester intact');
  assert(result.data.availableGroups.tutorials.includes('3MET-016') && !result.data.availableGroups.tutorials.includes('-016'),
    'REAL PORTAL: dropdown key is "3MET-016", not the anonymous "-016" (the legacy synthetic bare-tag cells may still produce "-011" by design)');
  assert(result.data.availableGroups.german.includes('DE303'),
    'REAL PORTAL: German dropdown registers DE303 from the course code itself (the DE token is dropped as the course code, so token-based registration alone leaves the German dropdown empty)');
  const mathLecReal = slots.find(s => s.course === 'MATH301' && s.day === 'Thursday' && s.period === 3);
  assert(mathLecReal && mathLecReal.isCohort === true && mathLecReal.groups.length === 0,
    'REAL PORTAL: lecture row whose tag column reads "3 MET III 3G" (no T-number) stays a clean cohort lecture');

  // ---------- popup filter engine (real computeFilteredSlots) ----------
  const filter = (tutorial, german) => computeFilteredSlots(slots, { tutorial: tutorial || '', german: german || '', elective: '' });
  // Scoped to Thursday: the synthetic legacy suite also carries a
  // token-based DE303 slot (Monday's "DE303 T012") that legitimately
  // matches a German selection too.
  assert(filter('', 'DE303').filter(s => s.course === 'DE303' && s.day === 'Thursday').length === 9,
    'FILTER: German level alone (no tutorial selected) matches all 9 rows — with no group chosen there is nothing else to narrow by');
  const bothSelected = filter('3MET-019', 'DE303').filter(s => s.course === 'DE303' && s.day === 'Thursday');
  assert(bothSelected.length === 1 && bothSelected[0].room === 'C2.108',
    'FILTER: German level + own tutorial group yields exactly ONE DE303 row (room C2.108), not all 9 stacked rooms — the German stacking regression');
  const tutOnly = filter('3MET-019', '');
  assert(tutOnly.some(s => s.course === 'DE303' && s.room === 'C2.108'),
    'FILTER: tutorial group alone still pulls in the German row tagged with it');
  assert(tutOnly.some(s => s.course === 'MATH301'),
    'FILTER: service-course lecture (MATH301 — course prefix is not a faculty code) is NOT hidden from a MET-group student');
  assert(!tutOnly.some(s => s.course === 'CSEN401' && s.type === 'Lecture' && s.day === 'Saturday'),
    'FILTER: another faculty\'s cohort lecture (CSEN401 vs selected MET group) is still excluded');

  return { results, parseResult: result };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runGucParserTests };
}
