/**
 * GUC Schedule Matrix: Controller, State Manager & ICS Exporter (v2.0.0)
 *
 * WORKING_DAYS / ICS_DAY_MAP / JS_DAY_INDEX / PERIODS / groupTokenKey all
 * come from shared-constants.js, loaded before this file in popup.html —
 * this file no longer keeps its own copy of any of those (that drift is
 * what caused the original Saturday-missing bug).
 */

const GUC_SCHEDULE_URL = 'https://apps.guc.edu.eg/student_ext/Scheduling/GeneralGroupSchedule.aspx';

// Application State
const state = {
  rawSlots: [],
  availableGroups: { tutorials: [], german: [], electives: [] },
  selectedTutorial: '',   // a groupTokenKey, e.g. "5MCTR-041"
  selectedGerman: '',     // a DE level, e.g. "DE201"
  selectedElective: '',   // a track+number key, e.g. "CPS031"
  lastSynced: null
};

// DOM References
const elements = {
  statusBadge: document.getElementById('statusIndicator'),
  errorBanner: document.getElementById('errorBanner'),
  errorText: document.getElementById('errorText'),
  openScheduleBtn: document.getElementById('openScheduleBtn'),
  tutSelect: document.getElementById('tutSelect'),
  tutTranslator: document.getElementById('tutTranslator'),
  deSelect: document.getElementById('deSelect'),
  smSelect: document.getElementById('smSelect'),
  exportBtn: document.getElementById('exportIcsBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  gridMatrix: document.getElementById('gridMatrix'),
  emptyState: document.getElementById('emptyState'),
  syncTimestamp: document.getElementById('syncTimestamp')
};

// Application Initialization
document.addEventListener('DOMContentLoaded', async () => {
  attachEventListeners();
  await loadPersistedState();
  await initScheduleScan();
});

function attachEventListeners() {
  elements.tutSelect.addEventListener('change', (e) => {
    state.selectedTutorial = e.target.value;
    persistUserPreferences();
    updateTranslatorPanel();
    renderSchedule();
  });

  elements.deSelect.addEventListener('change', (e) => {
    state.selectedGerman = e.target.value;
    persistUserPreferences();
    renderSchedule();
  });

  elements.smSelect.addEventListener('change', (e) => {
    state.selectedElective = e.target.value;
    persistUserPreferences();
    renderSchedule();
  });

  elements.exportBtn.addEventListener('click', generateAndDownloadICS);
  elements.refreshBtn.addEventListener('click', () => initScheduleScan(true));
  elements.openScheduleBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: GUC_SCHEDULE_URL });
  });
}

// State Persistence via chrome.storage.local
async function loadPersistedState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['guc_schedule_cache', 'guc_user_prefs'], (result) => {
      if (result.guc_user_prefs) {
        state.selectedTutorial = result.guc_user_prefs.tutorial || '';
        state.selectedGerman = result.guc_user_prefs.german || '';
        state.selectedElective = result.guc_user_prefs.elective || '';
      }
      if (result.guc_schedule_cache) {
        state.rawSlots = result.guc_schedule_cache.slots || [];
        state.availableGroups = result.guc_schedule_cache.availableGroups || { tutorials: [], german: [], electives: [] };
        state.lastSynced = result.guc_schedule_cache.timestamp || null;
        updateUIWithCachedData();
      }
      resolve();
    });
  });
}

function persistUserPreferences() {
  chrome.storage.local.set({
    guc_user_prefs: {
      tutorial: state.selectedTutorial,
      german: state.selectedGerman,
      elective: state.selectedElective
    }
  });
}

function persistScheduleCache(slots, availableGroups) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.lastSynced = timestamp;
  chrome.storage.local.set({
    guc_schedule_cache: { slots, availableGroups, timestamp }
  });
  elements.syncTimestamp.textContent = `Synced at ${timestamp}`;
}

// Active Tab Scraping Orchestration
async function initScheduleScan(isForce = false) {
  updateStatus('scanning', 'Scanning Tab...');
  hideError();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes('apps.guc.edu.eg')) {
      if (state.rawSlots.length > 0 && !isForce) {
        updateStatus('ready', 'Offline Cache');
        return;
      }
      updateStatus('error', 'GUC Tab Not Detected');
      showError('Open your GUC schedule page in the active tab, then click "Force Re-scan".', true);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'PARSE_GUC_SCHEDULE' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        if (state.rawSlots.length > 0) {
          updateStatus('ready', 'Using Cache');
        } else {
          updateStatus('error', 'Table Not Found');
        }
        const errMsg = (response && response.error)
          ? response.error
          : 'Could not read the schedule table. Make sure you are logged in and on the schedule page, then reload it and try again.';
        showError(errMsg, true);
        return;
      }

      state.rawSlots = response.data.slots;
      state.availableGroups = response.data.availableGroups;
      persistScheduleCache(state.rawSlots, state.availableGroups);

      populateDropdowns();
      updateTranslatorPanel();
      updateStatus('ready', 'Synced Live');
      renderSchedule();
    });
  } catch (err) {
    updateStatus('error', 'Scan Error');
    showError('Unexpected error while scanning the tab: ' + (err && err.message ? err.message : String(err)));
  }
}

function updateStatus(type, message) {
  elements.statusBadge.className = `status-badge status-${type}`;
  elements.statusBadge.textContent = message;
}

function showError(message, showOpenLink = false) {
  elements.errorText.textContent = message;
  elements.errorBanner.classList.remove('hidden');
  elements.openScheduleBtn.classList.toggle('hidden', !showOpenLink);
}

function hideError() {
  elements.errorBanner.classList.add('hidden');
  elements.errorText.textContent = '';
  elements.openScheduleBtn.classList.add('hidden');
}

function updateUIWithCachedData() {
  if (state.lastSynced) {
    elements.syncTimestamp.textContent = `Cached: ${state.lastSynced}`;
  }
  populateDropdowns();
  updateTranslatorPanel();
  renderSchedule();
}

function populateDropdowns() {
  populateSelect(elements.tutSelect, state.availableGroups.tutorials, state.selectedTutorial, 'Select Tutorial/Practical');
  populateSelect(elements.deSelect, state.availableGroups.german, state.selectedGerman, 'Select German');
  populateSelect(elements.smSelect, state.availableGroups.electives, state.selectedElective, 'Select Elective');

  const hasData = state.rawSlots.length > 0;
  elements.tutSelect.disabled = !hasData;
  elements.deSelect.disabled = !hasData;
  elements.smSelect.disabled = !hasData;
  elements.exportBtn.disabled = !hasData;
}

function populateSelect(selectElement, items, selectedValue, defaultLabel) {
  selectElement.innerHTML = `<option value="">${defaultLabel}</option>`;
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    if (item === selectedValue) option.selected = true;
    selectElement.appendChild(option);
  });
}

// Group-Code Translator: decodes a selected tutorial/practical key like
// "5MCTR-041" into "Mechatronics Engineering — 5th Semester — Tutorial
// Group 41" (kind is a best-effort guess since the unified key doesn't
// retain it — see decodeTutorialKey for details).
function decodeTutorialKey(key) {
  if (!key) return null;
  const m = key.match(/^(\d)?([A-Z]*)-(\d+)$/);
  if (!m) return null;
  const [, semester, major, number] = m;
  const majorName = major && MAJOR_NAMES[major] ? MAJOR_NAMES[major] : (major || null);
  const parts = [];
  if (majorName) parts.push(majorName);
  if (semester) parts.push(`${semester}${ordinalSuffix(semester)} Semester`);
  parts.push(`Group ${parseInt(number, 10)}`);
  return parts.join(' — ');
}

function ordinalSuffix(n) {
  const num = parseInt(n, 10);
  if (num === 1) return 'st';
  if (num === 2) return 'nd';
  if (num === 3) return 'rd';
  return 'th';
}

function updateTranslatorPanel() {
  if (!elements.tutTranslator) return;
  const decoded = decodeTutorialKey(state.selectedTutorial);
  if (decoded) {
    elements.tutTranslator.textContent = decoded;
    elements.tutTranslator.classList.remove('hidden');
  } else {
    elements.tutTranslator.textContent = '';
    elements.tutTranslator.classList.add('hidden');
  }
}

// Matching & Group Filter Engine.
//
// computeFilteredSlots is deliberately pure — raw slots plus an explicit
// selection object in, filtered array out — so the offline test harness
// (and its Node runner) exercise the exact filtering code the popup runs.
// The German-stacking regression test lives in the harness precisely
// because a filter bug is invisible to DOM-parser-only tests.
function computeFilteredSlots(rawSlots, selection) {
  if (!rawSlots || !rawSlots.length) return [];

  const selectedTutorialParsed = selection.tutorial ? parseGroupKey(selection.tutorial) : null;

  return rawSlots.filter(slot => {
    // 1. Cohort lectures apply to everyone, UNLESS both the lecture's
    // course-code prefix and the selected group's major are real faculty
    // codes (MAJOR_NAMES) that differ. A raw prefix comparison alone would
    // hide service courses from everyone once real portal tags make the
    // selected major non-null — "MATH" !== "MET" is not evidence that a
    // MATH301 lecture isn't for MET students.
    if (slot.isCohort) {
      if (!selectedTutorialParsed || !selectedTutorialParsed.major || !slot.cohortMajor) return true;
      if (!MAJOR_NAMES[slot.cohortMajor] || !MAJOR_NAMES[selectedTutorialParsed.major]) return true;
      return slot.cohortMajor === selectedTutorialParsed.major;
    }

    const groups = slot.groups || [];

    // 2. Tutorial & Practical matching — unified by group NUMBER, since a
    // "T041" and "P041" are the same section (lecture-group pairing), not
    // two lookups joined by string-replacing T<->P.
    if (selectedTutorialParsed && matchesSelectedTutorialGroup(groups, selectedTutorialParsed)) {
      return true;
    }

    // 3. German Language slot matching. Real portal markup: a German
    // course's tutorial rows are stacked one row per group inside the same
    // period cell — "DE303 Tut | C2.105 | 3 MET III 3G T016", "DE303 Tut |
    // C2.106 | 3 MET III 3G T017", ... — every row sharing the course
    // code. The DE level identifies the COURSE, not the row; the row's own
    // tutorial tag identifies the student's room. So when a tutorial group
    // is also selected, rule 2 above has already decided this row on its
    // own group tag, and the level must NOT also pull in the other rooms'
    // rows stacked in the same cell. Level-only matching applies only when
    // no tutorial group is selected to narrow by.
    if (selection.german) {
      if (groups.some(g => g.category === 'german' && g.level === selection.german)) return true;
      if (slot.course === selection.german && !selectedTutorialParsed) return true;
    }

    // 4. Elective/Humanities matching (token-based; elective rows have not
    // been validated against real portal markup yet).
    if (selection.elective) {
      if (groups.some(g => g.category === 'elective' && (g.track + (g.number || '')) === selection.elective)) return true;
    }

    return false;
  });
}

// True when one of the slot's group tokens is the selected tutorial/
// practical group. The group NUMBER is the identity; the major is compared
// only when both sides actually carry one (real portal tags do, legacy/
// bare tags don't).
function matchesSelectedTutorialGroup(groups, selected) {
  return groups.some(g =>
    (g.category === 'tutorial' || g.category === 'practical') &&
    g.number === selected.number &&
    (!selected.major || !g.major || g.major === selected.major)
  );
}

function getFilteredSlots() {
  return computeFilteredSlots(state.rawSlots, {
    tutorial: state.selectedTutorial,
    german: state.selectedGerman,
    elective: state.selectedElective
  });
}

// Parses a groupTokenKey like "5MCTR-041" back into its parts for matching.
function parseGroupKey(key) {
  const m = key.match(/^(\d)?([A-Z]*)-(\d+)$/);
  if (!m) return null;
  return { semester: m[1] || null, major: m[2] || null, number: m[3] };
}

// 5x5 Matrix Rendering Engine (Saturday first, per GUC's Sat–Thu week)
function renderSchedule() {
  const filteredSlots = getFilteredSlots();

  if (!state.rawSlots.length) {
    elements.emptyState.classList.remove('hidden');
    elements.gridMatrix.classList.add('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.gridMatrix.classList.remove('hidden');
  elements.gridMatrix.innerHTML = '';

  // 1. Header: Top-left Corner Cell
  const cornerCell = document.createElement('div');
  cornerCell.className = 'grid-cell header-cell corner-cell';
  cornerCell.innerHTML = '<strong>Day</strong><span>Periods</span>';
  elements.gridMatrix.appendChild(cornerCell);

  // 2. Header: Period Labels (1 to 5) with exact timings
  PERIODS.forEach(p => {
    const pCell = document.createElement('div');
    pCell.className = 'grid-cell header-cell';
    pCell.innerHTML = `<strong>${p.label}</strong><span class="period-time">${p.start} - ${p.end}</span>`;
    elements.gridMatrix.appendChild(pCell);
  });

  // 3. Build Matrix Rows for Each Working Day (Saturday first)
  WORKING_DAYS.forEach(day => {
    const dayLabelCell = document.createElement('div');
    dayLabelCell.className = 'grid-cell day-header-cell';
    dayLabelCell.innerHTML = `<span>${day}</span>`;
    elements.gridMatrix.appendChild(dayLabelCell);

    PERIODS.forEach(period => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell matrix-slot';

      const matchingSlots = filteredSlots.filter(s => s.day === day && s.period === period.id);

      if (matchingSlots.length === 0) {
        cell.classList.add('slot-free');
        cell.innerHTML = '<span class="free-indicator">—</span>';
      } else {
        matchingSlots.forEach(slot => {
          const card = createSlotCard(slot);
          cell.appendChild(card);
        });
      }
      elements.gridMatrix.appendChild(cell);
    });
  });
}

function createSlotCard(slot) {
  const card = document.createElement('div');
  const typeKey = getBadgeTypeKey(slot);

  card.className = `slot-card badge-${typeKey}`;
  card.innerHTML = `
    <div class="card-course">${escapeHTML(slot.course)}</div>
    <div class="card-meta">
      <span class="card-type">${escapeHTML(slot.type)}</span>
      <span class="card-room">${escapeHTML(slot.room)}</span>
    </div>
  `;
  return card;
}

function getBadgeTypeKey(slot) {
  if (slot.isCohort) return 'lecture';
  const primary = slot.group;
  if (primary) {
    if (primary.category === 'german') return 'german';
    if (primary.category === 'elective') return 'elective';
  }
  const typeLower = (slot.type || '').toLowerCase();
  if (typeLower.includes('lab')) return 'lab';
  return 'tut';
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// RFC 5545 iCalendar File Exporter
function generateAndDownloadICS() {
  const filteredSlots = getFilteredSlots();
  if (!filteredSlots.length) {
    alert('No active slots available to export. Please select your groups.');
    return;
  }

  // Anchor dates: next real upcoming occurrence of each weekday from today.
  // Adjust computeUpcomingWeekDates() below if you want a different start
  // week (see README "Changing the export start date").
  const baseDateMap = computeUpcomingWeekDates();

  let icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GUC Schedule Matrix//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:GUC Semester Schedule',
    'X-WR-TIMEZONE:Africa/Cairo'
  ];

  filteredSlots.forEach((slot, index) => {
    const dayCode = ICS_DAY_MAP[slot.day];
    const baseDate = baseDateMap[slot.day];
    const periodData = PERIODS.find(p => p.id === slot.period);

    if (!dayCode || !baseDate || !periodData) return;

    const startDT = `${baseDate}T${periodData.icsStart}`;
    const endDT = `${baseDate}T${periodData.icsEnd}`;
    const uid = `guc-${slot.course}-${slot.day}-${slot.period}-${index}@matrix`;
    const groupLabel = slot.group ? slot.group.raw : 'Common Lecture';

    icsLines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;TZID=Africa/Cairo:${startDT}`,
      `DTEND;TZID=Africa/Cairo:${endDT}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${dayCode};COUNT=14`,
      `SUMMARY:${slot.course} - ${slot.type}`,
      `LOCATION:Room ${slot.room}, GUC Campus`,
      `DESCRIPTION:Class Type: ${slot.type}\\nGroup Tag: ${groupLabel}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  icsLines.push('END:VCALENDAR');

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');

  const groupLabel = state.selectedTutorial || 'Cohort';
  downloadAnchor.href = downloadUrl;
  downloadAnchor.download = `GUC_Schedule_${groupLabel}.ics`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
  URL.revokeObjectURL(downloadUrl);
}

// Calculates the date (YYYYMMDD) of the next occurrence of each working day,
// starting from today, so exports always anchor to a real upcoming week
// instead of a hardcoded past/future semester date.
function computeUpcomingWeekDates() {
  const today = new Date();
  const result = {};

  WORKING_DAYS.forEach(day => {
    const targetIdx = JS_DAY_INDEX[day];
    const currentIdx = today.getDay();
    let diff = targetIdx - currentIdx;
    if (diff < 0) diff += 7;
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day2 = String(d.getDate()).padStart(2, '0');
    result[day] = `${y}${m}${day2}`;
  });

  return result;
}

// Offline test harness hook: lets tests/test-harness.html (and its Node
// runner) call the real filter engine without a chrome.* runtime.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeFilteredSlots, parseGroupKey };
}
