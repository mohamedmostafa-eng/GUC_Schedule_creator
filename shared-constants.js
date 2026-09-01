/**
 * GUC Schedule Matrix — Shared Constants
 *
 * Single source of truth for anything that content.js (the DOM parser) and
 * popup.js (the renderer/exporter) both need to agree on. This file exists
 * because the previous build kept two separate, hand-copied WORKING_DAYS
 * arrays — one in each file — and they drifted out of sync (popup.js's copy
 * silently started the week on Sunday and dropped Saturday). Loading this
 * file first in both manifest.json's content_scripts and popup.html means
 * there is now exactly one array to edit.
 *
 * Loaded as a plain classic script (no ES modules) in three contexts:
 *   - content.js on the live GUC portal page (via manifest.json)
 *   - popup.js in the extension popup (via popup.html)
 *   - tests/test-harness.html, the offline parser test page
 * In all three it just needs to define these as page-global consts, so no
 * export/import machinery is used.
 */

// GUC's academic week runs Saturday through Thursday. Saturday must stay
// first — it defines the rendered grid's row order and the PDF export.
const WORKING_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

// GUC's five class periods and their exact bell times.
const PERIODS = [
  { id: 1, label: '1st Period', start: '08:15', end: '09:45' },
  { id: 2, label: '2nd Period', start: '10:00', end: '11:30' },
  { id: 3, label: '3rd Period', start: '11:45', end: '13:15' },
  { id: 4, label: '4th Period', start: '13:45', end: '15:15' },
  { id: 5, label: '5th Period', start: '15:45', end: '17:15' }
];

// German has exactly 4 levels at GUC. The semester digit moves together
// with the level (101 -> 202 -> 303 -> 404), not a fixed "1/2/3/4-01"
// pattern — content.js builds its matching regex directly from this array
// (GERMAN_DIGITS), so this is now the actual single source of truth for
// which DE codes are recognized, not just documentation.
const GERMAN_LEVELS = ['DE101', 'DE202', 'DE303', 'DE404'];

// Electives/Humanities have exactly 5 tracks at GUC.
const ELECTIVE_TRACKS = ['AE', 'AS', 'SM', 'CPS', 'RPW'];

// Canonical form for course-code comparisons. The portal renders codes both
// compact ("DE303") and space-separated ("ELCT 708", "PHYSt 301"), so
// content.js (German-level registration) and popup.js (German filter match)
// must normalize BOTH sides through this helper — a raw string comparison
// is what made spaced German rows invisible to the German dropdown.
function normalizeCourseCode(code) {
  return String(code || '').replace(/\s+/g, '').toUpperCase();
}

// Faculty/major abbreviation dictionary for the group-code translator.
// Not an exhaustive/official GUC list — compiled from commonly seen major
// codes. Anything not in here still decodes structurally (semester/kind/
// number), just without a friendly major name. Extend as needed.
const MAJOR_NAMES = {
  MCTR: 'Mechatronics Engineering',
  MET: 'Media Engineering & Technology',
  IET: 'Information Engineering & Technology',
  CSEN: 'Computer Science & Engineering',
  ENME: 'Engineering Mechanics',
  ELCT: 'Electronics Engineering',
  ARCH: 'Architecture Engineering',
  CIVIL: 'Civil Engineering',
  BI: 'Biotechnology',
  PHRM: 'Pharmacy',
  MGT: 'Management',
  BINF: 'Business Informatics',
  EDPT: 'Engineering Design and Production Technology',
  DMET: 'Digital Media Engineering and Technology'
};

/**
 * Builds the stable string key used both to populate the tutorial/practical
 * dropdown (content.js) and to match a selected dropdown value back against
 * a slot's group tokens (popup.js). Keeping this in one shared place is
 * what lets the two files agree on group identity without drifting, the
 * same way WORKING_DAYS does for days.
 *
 * Shape: "<semester><MAJOR>-<number>", e.g. "5MCTR-041". Semester and/or
 * major may be absent if the portal cell didn't include them (e.g. a bare
 * "T011" tag) — the key degrades gracefully to "-011" in that case.
 */
function groupTokenKey(tok) {
  if (!tok) return null;
  return (tok.semester || '') + (tok.major || '') + '-' + tok.number;
}

// Makes these usable both as page-globals (classic <script>) and, if this
// file is ever loaded under Node/CommonJS (e.g. for jsdom-based tests),
// as module exports — without requiring a bundler for the extension itself.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WORKING_DAYS,
    PERIODS,
    GERMAN_LEVELS,
    ELECTIVE_TRACKS,
    MAJOR_NAMES,
    groupTokenKey,
    normalizeCourseCode
  };
}
