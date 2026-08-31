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
// first — both for the rendered grid columns and for iCalendar export.
const WORKING_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

// Maps each working day to its RFC 5545 BYDAY code for .ics export.
const ICS_DAY_MAP = {
  Saturday: 'SA',
  Sunday: 'SU',
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH'
};

// JS Date.getDay() index (0 = Sunday) for each working day, used to compute
// the next real calendar occurrence of a weekday for .ics export anchoring.
const JS_DAY_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

// GUC's five class periods and their exact bell times.
const PERIODS = [
  { id: 1, label: '1st Period', start: '08:15', end: '09:45', icsStart: '081500', icsEnd: '094500' },
  { id: 2, label: '2nd Period', start: '10:00', end: '11:30', icsStart: '100000', icsEnd: '113000' },
  { id: 3, label: '3rd Period', start: '11:45', end: '13:15', icsStart: '114500', icsEnd: '131500' },
  { id: 4, label: '4th Period', start: '13:45', end: '15:15', icsStart: '134500', icsEnd: '151500' },
  { id: 5, label: '5th Period', start: '15:45', end: '17:15', icsStart: '154500', icsEnd: '171500' }
];

// German has exactly 4 levels at GUC. The semester digit moves together
// with the level (101 -> 202 -> 303 -> 404), not a fixed "1/2/3/4-01"
// pattern — content.js builds its matching regex directly from this array
// (GERMAN_DIGITS), so this is now the actual single source of truth for
// which DE codes are recognized, not just documentation.
const GERMAN_LEVELS = ['DE101', 'DE202', 'DE303', 'DE404'];

// Electives/Humanities have exactly 5 tracks at GUC.
const ELECTIVE_TRACKS = ['AE', 'AS', 'SM', 'CPS', 'RPW'];

// Faculty/major abbreviation dictionary for the group-code translator.
// Not an exhaustive/official GUC list — compiled from commonly seen major
// codes. Anything not in here still decodes structurally (semester/kind/
// number), just without a friendly major name. Extend as needed.
const MAJOR_NAMES = {
  MCTR: 'Mechatronics Engineering',
  MET: 'Mechanical Engineering',
  IET: 'Industrial Engineering',
  CSEN: 'Computer Science Engineering',
  ENME: 'Energy Engineering',
  ELCT: 'Electronics Engineering',
  ARCH: 'Architecture Engineering',
  CIVIL: 'Civil Engineering',
  BI: 'Biotechnology',
  PHRM: 'Pharmacy',
  MGT: 'Management',
  MEDIA: 'Media Engineering & Technology',
  DMET: 'Design & Production Engineering'
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
    ICS_DAY_MAP,
    JS_DAY_INDEX,
    PERIODS,
    GERMAN_LEVELS,
    ELECTIVE_TRACKS,
    MAJOR_NAMES,
    groupTokenKey
  };
}
