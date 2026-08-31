/**
 * GUC Schedule Matrix - Hardened DOM Extraction Engine (v2.0.0)
 * Runs only on apps.guc.edu.eg (see manifest.json host_permissions).
 * Reads the schedule table already rendered in the page. Sends nothing
 * anywhere else — all data stays inside the browser (chrome.storage.local).
 *
 * v2.0.0 changes:
 *   - Two-pass extraction: a cell with a nested <table> is now read ONLY
 *     from that nested table's own cells. The parent cell's own text is no
 *     longer also parsed, which is what produced duplicate "GENERAL"/"TBA"
 *     junk entries alongside the real, correctly-parsed one.
 *   - Period index for spanned cells is now derived from the absolute
 *     column position in the master grid (not recalculated per nested
 *     loop), fixing ENME-style duplication across periods under rowspan.
 *   - Group tokens are normalized into {category, kind, number, major,
 *     semester} objects instead of raw strings, so T/P sections unify and
 *     German/elective classification uses the real GUC category lists
 *     (see shared-constants.js) instead of substring guessing.
 *   - WORKING_DAYS/PERIODS now come from shared-constants.js, loaded
 *     before this file by manifest.json (and by the test harness), so
 *     this file and popup.js can no longer drift out of sync.
 */

// Comprehensive Regex Tokenizers. \s* (not \s?) throughout so multi-space /
// tab / newline gaps in innerText — common once text comes from nested
// <table> cells or multi-<td> rows — don't silently break a match.
const REGEX_COURSE = /\b([A-Z]{2,6}\s*\d{3}[A-Za-z]?)\b/;
const REGEX_ROOM = /\b(H\d{1,2}[A-Z]?|[A-G]\d\.\d{3})\b/i;
const REGEX_TYPE = /\b(Lecture|Tut(?:orial)?|Lab|Prac(?:tical)?)\b/i;

// German-level and elective-track alternations are built FROM
// shared-constants.js's GERMAN_LEVELS / ELECTIVE_TRACKS instead of being
// hardcoded a second time here. Previously this file (and
// classifyGroupToken below) each hardcoded their own literal digit list —
// "101|201|301|401" — completely independent of GERMAN_LEVELS despite the
// comment in shared-constants.js calling it the single source of truth.
// GUC's real levels are DE101/DE202/DE303/DE404 (the semester digit moves
// with the level), not DE101/201/301/401, so that hardcoded list never
// matched levels 2-4 at all. Deriving the regex from the array means
// editing GERMAN_LEVELS in one place is now enough.
const GERMAN_DIGITS = GERMAN_LEVELS.map(l => l.replace(/^DE/i, '')).join('|');
const ELECTIVE_ALT = ELECTIVE_TRACKS.join('|');

// The REAL portal group tag — transcribed from outerHTML copied off the
// live schedule page — is a single space-separated text node in its own
// <td> of the row, alongside sibling course and room <td>s:
//     3 MET III 3G T019
//     | |   |   |  +-- tutorial/practical group number
//     | |   |   +----- section ("3G")
//     | |   +--------- academic year, roman numerals ("III")
//     | +------------- major/faculty code ("MET")
//     +--------------- semester digit
// The legacy major-prefixed alternative below allows at most one short gap
// between major and number and can never span "III 3G", so on real markup
// every one of these tags silently degraded to the bare "T019" fallback,
// dropping semester and major. The dedicated alternative below matches the
// validated shape directly; \s+ separators also cover variants where the
// portal renders the parts on separate lines.
//
// Finds candidate group/section tokens in a cell's text. Alternation order:
// German level (+ optional T/P group) first, then elective track (+ optional
// course number / T/P group), then the real-portal 5-part tag, then a
// legacy compact major-prefixed T/P group, then a bare T/P group.
//
// The (?<![A-Za-z0-9]) guard (widened from the old (?<!\d)-only version)
// stops a token from starting mid-word: it still stops a trailing digit
// from a course code (e.g. the "1" in "CSEN401") from being swallowed into
// the next token, and now also stops "AS"/"SM"/etc. from matching inside
// an unrelated all-caps word fragment (e.g. would-be "...DE401" tail of
// "GUIDE401", or "AS" inside "MAS204"). The trailing \b after the elective
// alternation blocks the mirror case — "AS" matching as a prefix of
// "ASSIGN201" — since \b fails between two word characters.
//
// The 'i' (case-insensitive) flag has been dropped. GUC's own group tags
// are always upper-case in the portal markup; matching case-insensitively
// meant this pattern also fired inside ordinary lowercase prose sitting in
// the same cell (e.g. the "as" in "same room as before"), which is what
// caused the elective-track false positives/pollution.
const REGEX_GROUP_TOKENS = new RegExp(
  '(?<![A-Za-z0-9])(?:' +
    'DE\\s*(?:' + GERMAN_DIGITS + ')(?:\\s*(?:T|P)\\d{1,3})?' + // German level [+ group]
    '|(?:' + ELECTIVE_ALT + ')(?![A-Za-z])(?:\\s*\\d{2,3})?(?:\\s*(?:T|P)\\d{1,3})?' + // elective track [+ course#] [+ group]
    '|\\d\\s+[A-Z]{2,6}\\s+(?:[IVX]{1,4}\\s+)?(?:\\d{1,2}[A-Z]\\s+)?(?:T|P)\\d{1,3}' + // real-portal 5-part tag, e.g. "3 MET III 3G T019"
    '|\\d?[A-Z]{2,6}[\\s-]?\\d{0,2}[\\s&-]*(?:T|P)\\d{1,3}' + // legacy compact major-prefixed T/P group (allows "3 IET-8 & MET11 T011"-style noise before it)
    '|(?:T|P)\\d{1,3}' + // bare T/P group
  ')',
  'g'
);

/**
 * Classifies a single matched group token into a normalized shape shared
 * by content.js (for the dropdown lists) and popup.js (for filtering and
 * the group-code translator).
 */
function classifyGroupToken(rawToken) {
  const compact = rawToken.replace(/\s+/g, '').toUpperCase();

  // German level, optionally with a trailing T/P group. Built from
  // GERMAN_DIGITS (see above) instead of a separately hardcoded list, so
  // this can't drift out of sync with the tokenizer regex the way the old
  // DE(101|201|301|401) pattern did.
  let m = compact.match(new RegExp('DE(' + GERMAN_DIGITS + ')(?:(T|P)(\\d{1,3}))?$'));
  if (m) {
    return {
      raw: rawToken.trim(),
      normalized: compact,
      category: 'german',
      level: 'DE' + m[1],
      kind: m[2] ? (m[2] === 'T' ? 'tutorial' : 'practical') : null,
      number: m[3] || null
    };
  }

  // Elective/Humanities track, optional course number and/or trailing T/P
  // group number. Built from ELECTIVE_ALT for the same reason.
  m = compact.match(new RegExp('(' + ELECTIVE_ALT + ')(\\d{2,3})?(?:(T|P)(\\d{1,3}))?$'));
  if (m) {
    return {
      raw: rawToken.trim(),
      normalized: compact,
      category: 'elective',
      track: m[1],
      courseNumber: m[2] || null,
      kind: m[3] ? (m[3] === 'T' ? 'tutorial' : 'practical') : null,
      number: m[4] || null
    };
  }

  // Real-portal 5-part tag after compaction: "3 MET III 3G T019" ->
  // "3METIII3GT019". The major group is non-greedy so the roman-numeral
  // year is left to its own group where both parses are possible
  // ("MET" + "III", not "METIII"): a shorter major only survives
  // backtracking when the year/section groups can still consume everything
  // up to the T/P number, which is also why legacy compact forms like
  // "3MCTRT041" still resolve to MCTR here.
  m = compact.match(/^(\d)([A-Z]{2,6}?)(?:[IVX]{1,4})?(?:\d{1,2}[A-Z])?(T|P)(\d{1,3})$/);
  if (m) {
    return {
      raw: rawToken.trim(),
      normalized: compact,
      category: m[3] === 'T' ? 'tutorial' : 'practical',
      semester: m[1],
      major: m[2],
      kind: m[3] === 'T' ? 'tutorial' : 'practical',
      number: m[4]
    };
  }

  // Major-prefixed or bare tutorial/practical group, e.g. "5MCTRT041",
  // "3MET T011", "T011". A leading semester digit and/or major letters are
  // optional; only the T/P + number at the end is required.
  m = compact.match(/(\d)?([A-Z]{2,6})?(?:[-\d&]*)?(T|P)(\d{1,3})$/);
  if (m) {
    return {
      raw: rawToken.trim(),
      normalized: compact,
      category: m[3] === 'T' ? 'tutorial' : 'practical',
      semester: m[1] || null,
      major: m[2] || null,
      kind: m[3] === 'T' ? 'tutorial' : 'practical',
      number: m[4]
    };
  }

  return { raw: rawToken.trim(), normalized: compact, category: 'unknown', kind: null, number: null };
}

// Among several candidate tokens matched in one cell (compound cross-faculty
// cells like "3 IET-8 & MET11 SM T011"), prefer the most specific one: a
// German level or elective track beats a generic tutorial/practical
// fragment, which beats an unclassified leftover.
function pickPriorityToken(classifiedTokens) {
  const byCategory = (cats) => classifiedTokens.find(t => cats.includes(t.category));
  return (
    byCategory(['german', 'elective']) ||
    byCategory(['tutorial', 'practical']) ||
    classifiedTokens[0] ||
    null
  );
}

// Best-effort major code implied by a course code's letter prefix (e.g.
// "ELCT" from "ELCT501"), used to filter cohort lectures by the student's
// selected major when the lecture itself carries no explicit group tag.
function inferMajorFromCourse(courseCode) {
  if (!courseCode) return null;
  const m = courseCode.replace(/\s+/g, '').match(/^([A-Z]{2,6})\d/);
  return m ? m[1] : null;
}

function parseGUCMatrixDOM() {
  try {
    const tables = Array.from(document.querySelectorAll('table'));

    // 1. Identify primary timetable matrix
    const masterTable = tables.find(t => {
      const text = t.innerText || '';
      return text.includes('First Period') && (text.includes('Fifth Period') || text.includes('Fourth Period'));
    });

    if (!masterTable) {
      return {
        success: false,
        error: 'Could not locate the timetable table. Please ensure you are logged in to the GUC portal and are on the schedule page.'
      };
    }

    const extractedSlots = [];
    const discoveredGroups = {
      tutorials: new Set(), // unified T/P groups, keyed by normalized number (e.g. "MCTR-041")
      german: new Set(),
      electives: new Set()
    };

    // 2. Pass 1: build a virtual 2D grid to correctly resolve rowspan/colspan,
    // and record each origin cell's absolute starting column so period IDs
    // never get recalculated inside a nested loop (the ENME duplication bug).
    // IMPORTANT: masterTable.rows (not querySelectorAll('tr')) — the latter
    // descends into nested <table>s inside cells and would pull their <tr>
    // elements in as if they were top-level day rows, double-processing
    // them (once here, once again by the nested-table branch in pass 2).
    const rows = Array.from(masterTable.rows);
    const gridMatrix = [];
    let currentDay = null;

    rows.forEach((row, rowIndex) => {
      if (!gridMatrix[rowIndex]) gridMatrix[rowIndex] = [];

      const firstCellText = (row.cells[0]?.innerText || '').trim();
      for (const d of WORKING_DAYS) {
        if (firstCellText.startsWith(d)) {
          currentDay = d;
          break;
        }
      }

      let targetCol = 0;
      Array.from(row.children).forEach(cell => {
        while (gridMatrix[rowIndex][targetCol]) targetCol++;

        const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
        const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
        const originCol = targetCol; // absolute column, fixed regardless of rowspan

        for (let r = 0; r < rowspan; r++) {
          const rIdx = rowIndex + r;
          if (!gridMatrix[rIdx]) gridMatrix[rIdx] = [];
          for (let c = 0; c < colspan; c++) {
            gridMatrix[rIdx][targetCol + c] = {
              element: cell,
              day: currentDay,
              colspan,
              originCol,
              isOrigin: r === 0 && c === 0
            };
          }
        }
        targetCol += colspan;
      });
    });

    // 3. Pass 2: extract data from each unique origin cell.
    gridMatrix.forEach(row => {
      row.forEach(cellData => {
        if (!cellData || !cellData.isOrigin || !cellData.day) return;

        const cellText = (cellData.element.innerText || '').trim();
        if (!cellText || WORKING_DAYS.includes(cellText) || cellText.toLowerCase() === 'free') return;

        // Period ID comes from the origin cell's absolute column, clamped to
        // the 5 real periods (column 0 is the day-label column).
        const periodId = Math.min(Math.max(cellData.originCol, 1), 5);

        const nestedTables = cellData.element.querySelectorAll('table');
        if (nestedTables.length > 0) {
          // Nested table present: the parent <td>'s own innerText is NOT
          // parsed at all here — only the nested table's own rows are. This
          // is the fix for GENERAL-pollution/double-extraction: previously
          // the parent text was parsed too, producing a second bogus slot.
          nestedTables.forEach(nTable => {
            nTable.querySelectorAll('tr').forEach(nRow => {
              const nText = (nRow.innerText || '').trim();
              extractTokensAndRegister(nText, cellData.day, periodId, cellData.colspan, extractedSlots, discoveredGroups);
            });
          });
        } else {
          extractTokensAndRegister(cellText, cellData.day, periodId, cellData.colspan, extractedSlots, discoveredGroups);
        }
      });
    });

    return {
      success: true,
      data: {
        slots: extractedSlots,
        availableGroups: {
          tutorials: Array.from(discoveredGroups.tutorials).sort(),
          german: Array.from(discoveredGroups.german).sort(),
          electives: Array.from(discoveredGroups.electives).sort()
        }
      }
    };
  } catch (err) {
    return {
      success: false,
      error: 'Parser encountered an unexpected error: ' + (err && err.message ? err.message : String(err))
    };
  }
}

function extractTokensAndRegister(text, day, period, colspan, slotsArray, groupsTracker) {
  if (!text || text.toLowerCase() === 'free') return;

  // Room and type are matched locally against THIS node's own text only —
  // never inherited from a sibling nested node in the same parent cell.
  const courseMatch = text.match(REGEX_COURSE);
  const roomMatch = text.match(REGEX_ROOM);
  const typeMatch = text.match(REGEX_TYPE);

  // Group tokens are matched against the full original text (so compound
  // tokens like "DE201 T021" are still captured together), then any token
  // that turns out to be *exactly* the course code itself is dropped. This
  // is what stops a course code ending in "T"/"P" + digits (e.g. "ELCT501")
  // from being misread as its own T/P group tag, without losing German/
  // elective level info that legitimately sits right next to the course
  // code (e.g. "DE201 T021").
  const courseCompact = courseMatch ? courseMatch[0].replace(/\s+/g, '').toUpperCase() : null;
  const rawGroupTokens = text.match(REGEX_GROUP_TOKENS) || [];
  const classifiedTokens = rawGroupTokens
    .map(classifyGroupToken)
    .filter(tok => tok.normalized !== courseCompact);

  // Discard nodes with no course code AND no valid room+type — this is what
  // stops empty/leftover fragments from becoming "GENERAL" junk slots.
  if (!courseMatch && !roomMatch) return;

  const chosenToken = pickPriorityToken(classifiedTokens);

  const isLecture = /lecture/i.test(text) || (roomMatch && /^H/i.test(roomMatch[1]));
  const hasSubGroup = classifiedTokens.some(t => t.category !== 'unknown');
  // Cohort lecture rule: a lecture with no sub-group tag on it. This used
  // to also require colspan > 2, on the assumption that a cohort-wide
  // lecture cell would visibly span multiple columns in the master table.
  // On the real portal that isn't true — a single lecture entry sits in a
  // normal colspan="1" (or colspan="2" for the wrapping nested-table cell,
  // as in the ELCT501 test fixture) cell, so that condition was false for
  // essentially every real lecture, isCohort came back false, and popup.js's
  // filter — which only auto-shows slots where isCohort is true, and
  // otherwise requires a matching group tag — silently dropped every
  // lecture, since a plain lecture slot has no group tag to match against.
  // That's the "lectures do not appear at all" regression. Whether a slot
  // has a sub-group tag is already a strictly more reliable signal on its
  // own, so colspan is dropped from this condition entirely.
  const isCohort = isLecture && !hasSubGroup;

  const courseCode = courseMatch ? courseMatch[1].toUpperCase().replace(/\s+/g, ' ').trim() : 'GENERAL';

  // Register discovered groups for the popup's dropdowns.
  classifiedTokens.forEach(tok => {
    if (tok.category === 'german') {
      groupsTracker.german.add(tok.level);
    } else if (tok.category === 'elective') {
      groupsTracker.electives.add(tok.track + (tok.number ? tok.number : ''));
    } else if (tok.category === 'tutorial' || tok.category === 'practical') {
      groupsTracker.tutorials.add(groupTokenKey(tok));
    }
  });

  // On the real portal the German level IS the course code ("DE303 Tut"),
  // sitting in the course <td> of every stacked group row — the token scan
  // above never registers it, because the DE token is dropped as the
  // course code. Without this, the German dropdown comes up empty on real
  // markup even though every German row parsed fine. (Electives have not
  // been validated against real portal markup yet — see README — so their
  // registration stays token-based.)
  if (GERMAN_LEVELS.includes(courseCode)) {
    groupsTracker.german.add(courseCode);
  }

  slotsArray.push({
    day,
    period,
    course: courseCode,
    room: roomMatch ? roomMatch[1].toUpperCase() : 'TBA',
    type: typeMatch ? typeMatch[1] : (isLecture ? 'Lecture' : (chosenToken && chosenToken.kind === 'practical' ? 'Practical' : 'Tutorial')),
    groups: classifiedTokens,
    group: chosenToken, // primary/most-specific token, for quick display
    isCohort,
    cohortMajor: isCohort ? inferMajorFromCourse(courseCode) : null,
    rawText: text
  });
}

// Runtime messaging listener — the popup asks this content script to parse
// whatever is currently on the page and sends the result back.
// Guarded so this same file can also be loaded on the offline test harness
// page (tests/test-harness.html), which has no chrome.runtime API.
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PARSE_GUC_SCHEDULE') {
      sendResponse(parseGUCMatrixDOM());
    }
    return true;
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseGUCMatrixDOM, classifyGroupToken, extractTokensAndRegister };
}
