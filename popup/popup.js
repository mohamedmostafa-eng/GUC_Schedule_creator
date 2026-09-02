/**
 * GUC Schedule Matrix: Controller, State Manager & PDF Exporter (v4.0.0)
 *
 * WORKING_DAYS / PERIODS / GERMAN_LEVELS / groupTokenKey all come from
 * shared-constants.js, loaded before this file in popup.html — this file
 * no longer keeps its own copy of any of those (that drift is what caused
 * the original Saturday-missing bug).
 */

const GUC_SCHEDULE_URL = 'https://apps.guc.edu.eg/student_ext/Scheduling/GeneralGroupSchedule.aspx';

// Bump whenever the parser's slot shape or the filter's semantics change:
// chrome.storage.local survives extension reloads, so slots cached by an
// older parser would silently mask the fix until a manual re-scan.
// v4: German-row section tags no longer register as tutorial groups, and
// cached selections are now validated against the parsed group lists.
const SCHEDULE_CACHE_VERSION = 4;

// Application State
const state = {
  rawSlots: [],
  availableGroups: { tutorials: [], german: [], electives: [] },
  cohortName: '',         // from the portal's schedule-type dropdown, e.g. "IET & MET 3rd Semester I"
  selectedTutorial: '',   // a groupTokenKey, e.g. "5MCTR-041"
  selectedGerman: '',     // a DE level, e.g. "DE201"
  selectedElective: '',   // a track+number key, e.g. "CPS031"
  lastSynced: null
};
// DOM References
const elements = {
  statusBadge: document.getElementById('statusIndicator'),
  cohortChip: document.getElementById('cohortNameChip'),
  errorBanner: document.getElementById('errorBanner'),
  errorText: document.getElementById('errorText'),
  openScheduleBtn: document.getElementById('openScheduleBtn'),
  tutSelect: document.getElementById('tutSelect'),
  tutTranslator: document.getElementById('tutTranslator'),
  deSelect: document.getElementById('deSelect'),
  smSelect: document.getElementById('smSelect'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),
  filterHint: document.getElementById('filterHint'),
  exportBtn: document.getElementById('exportPdfBtn'),
  exportBtnLabel: document.getElementById('exportBtnLabel'),
  sizeToggleBtn: document.getElementById('sizeToggleBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  refreshFooterBtn: document.getElementById('refreshFooterBtn'),
  gridMatrix: document.getElementById('gridMatrix'),
  emptyState: document.getElementById('emptyState'),
  noMatchState: document.getElementById('noMatchState'),
  noMatchClearBtn: document.getElementById('noMatchClearBtn'),
  syncTimestamp: document.getElementById('syncTimestamp'),
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toastText'),
  toastIcon: document.getElementById('toastIcon'),
  filterBar: document.querySelector('.filter-bar'),
  scanOverlay: document.getElementById('scanOverlay')
};

// Small inline icons shown inside the status badge. Kept as raw SVG
// strings (instead of separate <use> refs) so the popup stays a single
// self-contained bundle with no icon sprite to ship or load.
const STATUS_ICONS = {
  loading: '<svg class="status-icon" width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"></circle></svg>',
  scanning: '<svg class="status-icon status-icon-spin" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path></svg>',
  ready: '<svg class="status-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  error: '<svg class="status-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>'
};

// Small type icons shown next to each slot card's type label — a
// colorblind-safe way to tell lecture/tutorial/lab/German/elective apart
// beyond just the badge color.
const TYPE_ICONS = {
  lecture: '<svg class="type-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
  tut: '<svg class="type-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>',
  lab: '<svg class="type-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 2v6.5L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10.5V2"></path><path d="M9 2h6"></path></svg>',
  german: '<svg class="type-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"></circle><path d="M8 15s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"></path></svg>',
  elective: '<svg class="type-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l2.7 6.6L21 9.3l-5 4.4 1.5 7.1L12 17l-5.5 3.8L8 13.7l-5-4.4 6.3-0.7z"></path></svg>'
};

let toastHideTimer = null;
let isExporting = false;

// Max slot cards rendered visibly inside one timetable cell before the
// rest collapse behind a "+N more" chip (compact/minimized mode only —
// the classic maximized layout hides the chips and keeps the plain
// internal cell slider).
const MAX_VISIBLE_CARDS = 2;

// UI size modes. "max" is the classic spacious layout from the main
// branch (900px, fixed 130px cells, footer re-scan link); "mini" is the
// v4.0 compact redesign (header actions, +N more chips, filter bar
// context row). The choice persists in chrome.storage.local under
// guc_ui_prefs; max is the default.
const UI_SIZE_STORAGE_KEY = 'guc_ui_prefs';

function isMaxMode() {
  return document.body.classList.contains('size-max');
}

function applyUiSize(size, persist = false) {
  // Legacy values from earlier builds ('fit'/'comfortable') map onto the
  // two current modes instead of breaking.
  const mini = size === 'mini' || size === 'comfortable';
  document.body.classList.toggle('size-max', !mini);
  const btn = elements.sizeToggleBtn;
  if (btn) {
    btn.setAttribute('aria-pressed', String(mini));
    btn.title = mini ? 'Switch to the classic maximized layout' : 'Switch to the compact minimized layout';
  }
  if (persist) {
    chrome.storage.local.set({ [UI_SIZE_STORAGE_KEY]: { size: mini ? 'mini' : 'max' } });
  }
}

// Today's day name (in WORKING_DAYS terms) so the grid can mark the
// current day's row header. Empty on Friday — GUC's week is Sat–Thu.
const TODAY_NAME = (() => {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const name = names[new Date().getDay()] || '';
  return WORKING_DAYS.includes(name) ? name : '';
})();

// Shows a small transient confirmation at the bottom of the popup, e.g.
// after a PDF export completes. type 'error' restyles the toast and swaps
// the icon. Auto-dismisses after `duration` ms.
const TOAST_ICONS = {
  success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>'
};

function showToast(message, type = 'success', duration = 3200) {
  if (!elements.toast || !elements.toastText) return;
  clearTimeout(toastHideTimer);
  elements.toastText.textContent = message;
  elements.toast.classList.toggle('toast-error', type === 'error');
  if (elements.toastIcon) {
    elements.toastIcon.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.success;
  }
  elements.toast.classList.add('toast-visible');
  toastHideTimer = setTimeout(() => {
    elements.toast.classList.remove('toast-visible');
  }, duration);
}

// Application Initialization
document.addEventListener('DOMContentLoaded', async () => {
  attachEventListeners();
  await loadPersistedState();
  await initScheduleScan();
});

function attachEventListeners() {
  // A tiny trailing debounce so rapidly flipping the filter dropdowns
  // doesn't restart the grid's stagger animation on every change event.
  let renderDebounceTimer = null;
  const scheduleRender = (delay = 80) => {
    clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(() => renderSchedule(), delay);
  };

  const onFilterChange = () => {
    persistUserPreferences();
    updateFilterBarState();
  };

  elements.tutSelect.addEventListener('change', (e) => {
    state.selectedTutorial = e.target.value;
    onFilterChange();
    updateTranslatorPanel();
    scheduleRender();
  });

  elements.deSelect.addEventListener('change', (e) => {
    state.selectedGerman = e.target.value;
    onFilterChange();
    scheduleRender();
  });

  elements.smSelect.addEventListener('change', (e) => {
    state.selectedElective = e.target.value;
    onFilterChange();
    scheduleRender();
  });

  elements.exportBtn.addEventListener('click', handleExportClick);
  elements.refreshBtn.addEventListener('click', () => initScheduleScan(true));
  if (elements.refreshFooterBtn) {
    elements.refreshFooterBtn.addEventListener('click', () => initScheduleScan(true));
  }
  elements.openScheduleBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: GUC_SCHEDULE_URL });
  });

  if (elements.clearFiltersBtn) {
    elements.clearFiltersBtn.addEventListener('click', clearAllFilters);
  }
  if (elements.noMatchClearBtn) {
    elements.noMatchClearBtn.addEventListener('click', clearAllFilters);
  }
  if (elements.sizeToggleBtn) {
    elements.sizeToggleBtn.addEventListener('click', () => {
      applyUiSize(isMaxMode() ? 'mini' : 'max', true);
    });
  }

  // "+N more" chips: one delegated listener expands/collapses an
  // overflowing cell in place — no re-render needed, and no nested
  // scrollbar ambiguity.
  elements.gridMatrix.addEventListener('click', (e) => {
    const chip = e.target.closest('.more-chip');
    if (!chip) return;
    const cell = chip.closest('.matrix-slot');
    if (!cell) return;
    const expanded = cell.classList.toggle('expanded');
    chip.setAttribute('aria-expanded', String(expanded));
    const label = chip.querySelector('.more-chip-label');
    if (label) label.textContent = expanded ? 'Show less' : `+${chip.dataset.hiddenCount} more`;
  });
}

// Export flow with deliberate feedback: the button shows a busy state
// while the PDF renders, success is confirmed by a toast, and failures
// land in an error toast instead of a dead silent click.
async function handleExportClick() {
  if (isExporting) return;

  if (!getFilteredSlots().length) {
    showToast('Nothing to export yet — pick your tutorial, German level or elective first.', 'error', 4500);
    return;
  }

  isExporting = true;
  const btn = elements.exportBtn;
  btn.disabled = true;
  btn.classList.add('btn-busy');
  if (elements.exportBtnLabel) elements.exportBtnLabel.textContent = 'Exporting…';

  try {
    generateAndDownloadPDF();
    showToast('PDF exported — check your downloads.');
  } catch (err) {
    showToast('PDF export failed: ' + (err && err.message ? err.message : String(err)), 'error', 5000);
  } finally {
    isExporting = false;
    btn.classList.remove('btn-busy');
    if (elements.exportBtnLabel) elements.exportBtnLabel.textContent = 'Export PDF';
    btn.disabled = state.rawSlots.length === 0;
  }
}

// State Persistence via chrome.storage.local
async function loadPersistedState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['guc_schedule_cache', 'guc_user_prefs', UI_SIZE_STORAGE_KEY], (result) => {
      // Size preference applies immediately — even with no schedule data —
      // so the popup never flashes the wrong density. Fit week is the
      // default for anyone who has never chosen.
      applyUiSize(result[UI_SIZE_STORAGE_KEY] && result[UI_SIZE_STORAGE_KEY].size);
      if (result.guc_user_prefs) {
        state.selectedTutorial = result.guc_user_prefs.tutorial || '';
        state.selectedGerman = result.guc_user_prefs.german || '';
        state.selectedElective = result.guc_user_prefs.elective || '';
      }
      if (result.guc_schedule_cache && result.guc_schedule_cache.parserVersion === SCHEDULE_CACHE_VERSION) {
        state.rawSlots = result.guc_schedule_cache.slots || [];
        state.availableGroups = result.guc_schedule_cache.availableGroups || { tutorials: [], german: [], electives: [] };
        state.cohortName = result.guc_schedule_cache.cohortName || '';
        state.lastSynced = result.guc_schedule_cache.timestamp || null;
        sanitizeSelections();
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

function persistScheduleCache(slots, availableGroups, cohortName) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.lastSynced = timestamp;
  chrome.storage.local.set({
    guc_schedule_cache: { slots, availableGroups, cohortName, timestamp, parserVersion: SCHEDULE_CACHE_VERSION }
  });
  elements.syncTimestamp.textContent = `Synced at ${timestamp}`;
}

// Invalid cached selections are cleared instead of being kept: a saved
// tutorial/level/elective from an older parser (or from a different
// cohort page) can silently stop being offered. Keeping it would filter
// the grid against a group that no longer exists — the view looks
// "randomly empty" with nothing telling the student their pick is dead.
// Runs whenever slots are (re)loaded; cleaned selections are persisted
// immediately so the stale value can't come back.
//
// Deliberately NOT run when there is no cache at all: with empty group
// lists every selection would look invalid, so a failed scan would wipe
// the user's saved groups. They are instead re-validated here right
// after every successful scan (see initScheduleScan).
function sanitizeSelections() {
  if (!state.rawSlots.length) return false;
  let changed = false;
  if (state.selectedTutorial && !state.availableGroups.tutorials.includes(state.selectedTutorial)) {
    state.selectedTutorial = '';
    changed = true;
  }
  if (state.selectedGerman && !state.availableGroups.german.includes(state.selectedGerman)) {
    state.selectedGerman = '';
    changed = true;
  }
  if (state.selectedElective && !state.availableGroups.electives.includes(state.selectedElective)) {
    state.selectedElective = '';
    changed = true;
  }
  if (changed) persistUserPreferences();
  return changed;
}

// Resets every dropdown to "no filter", persists, and re-renders.
function clearAllFilters() {
  state.selectedTutorial = '';
  state.selectedGerman = '';
  state.selectedElective = '';
  persistUserPreferences();
  elements.tutSelect.value = '';
  elements.deSelect.value = '';
  elements.smSelect.value = '';
  updateTranslatorPanel();
  updateFilterBarState();
  renderSchedule();
}

// The Clear-filters control only makes sense while at least one filter is
// active — hide it otherwise, and say how many filters are shaping the
// grid right now.
function updateFilterBarState() {
  const activeCount = [state.selectedTutorial, state.selectedGerman, state.selectedElective]
    .filter(Boolean).length;

  if (elements.clearFiltersBtn) {
    elements.clearFiltersBtn.classList.toggle('hidden', activeCount === 0);
  }
  if (elements.filterHint) {
    elements.filterHint.textContent =
      activeCount === 0 ? '' : (activeCount === 1 ? '1 filter active' : `${activeCount} filters active`);
  }
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
      showError("The current tab isn't on apps.guc.edu.eg. Open your GUC schedule page, then press Force Re-scan.", true);
      return;
    }

    const response = await requestScheduleParse(tab.id);

    if (!response || !response.success) {
      if (state.rawSlots.length > 0) {
        updateStatus('ready', 'Using Cache');
      } else {
        updateStatus('error', 'Table Not Found');
      }
      const errMsg = (response && response.error)
        ? response.error
        : "Couldn't read the schedule table. Log in to the portal, open your schedule page, wait for it to finish loading, then Force Re-scan.";
      showError(errMsg, true);
      return;
    }

    state.rawSlots = response.data.slots;
    state.availableGroups = response.data.availableGroups;
    state.cohortName = response.data.cohortName || '';
    persistScheduleCache(state.rawSlots, state.availableGroups, state.cohortName);
    sanitizeSelections();

    populateDropdowns();
    updateTranslatorPanel();
    renderCohortName();
    updateStatus('ready', 'Synced Live');
    renderSchedule();
  } catch (err) {
    updateStatus('error', 'Scan Error');
    showError('Unexpected error while scanning the tab: ' + (err && err.message ? err.message : String(err)));
  }
}

// Ask the content script in the tab to parse the page. When nothing
// answers, the tab was opened before the last extension reload/update, so
// the manifest-injected content script never ran there. Inject the scripts
// programmatically (content.js guards against double registration) and ask
// again — this is what makes Force Re-scan work without forcing the user
// to reload the portal page itself. A response of {success:false} is a
// REAL parse failure (e.g. not logged in) and is not retried.
async function requestScheduleParse(tabId) {
  let response = await sendTabMessage(tabId, { action: 'PARSE_GUC_SCHEDULE' });
  if (!response && chrome.scripting && chrome.scripting.executeScript) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['shared-constants.js', 'content.js']
      });
      response = await sendTabMessage(tabId, { action: 'PARSE_GUC_SCHEDULE' });
    } catch (injectionErr) {
      // Tab navigated away or refused injection — fall through and let
      // the normal failure path report it.
    }
  }
  return response;
}

function sendTabMessage(tabId, message) {
  return new Promise(resolve => {
    try {
      chrome.tabs.sendMessage(tabId, message, response => {
        resolve(chrome.runtime.lastError ? null : response);
      });
    } catch (err) {
      resolve(null);
    }
  });
}

function updateStatus(type, message) {
  elements.statusBadge.className = `status-badge status-${type}`;
  elements.statusBadge.innerHTML = `${STATUS_ICONS[type] || ''}<span class="status-text">${escapeHTML(message)}</span>`;

  const isScanning = type === 'scanning';
  if (elements.scanOverlay) elements.scanOverlay.classList.toggle('hidden', !isScanning);
  if (elements.filterBar) elements.filterBar.classList.toggle('scanning', isScanning);
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
    elements.syncTimestamp.textContent = `Offline cache · saved ${state.lastSynced}`;
  }
  populateDropdowns();
  updateTranslatorPanel();
  renderCohortName();
  renderSchedule();
}

function renderCohortName() {
  if (!elements.cohortChip) return;
  if (state.cohortName) {
    elements.cohortChip.textContent = state.cohortName;
    elements.cohortChip.classList.remove('hidden');
  } else {
    elements.cohortChip.textContent = '';
    elements.cohortChip.classList.add('hidden');
  }
}

function populateDropdowns() {
  populateSelect(elements.tutSelect, state.availableGroups.tutorials, state.selectedTutorial, 'Pick your tutorial…');
  populateSelect(elements.deSelect, state.availableGroups.german, state.selectedGerman, 'Pick your German level…');
  populateSelect(elements.smSelect, state.availableGroups.electives, state.selectedElective, 'Pick your elective…');

  const hasData = state.rawSlots.length > 0;
  elements.tutSelect.disabled = !hasData;
  elements.deSelect.disabled = !hasData;
  elements.smSelect.disabled = !hasData;
  elements.exportBtn.disabled = !hasData;
  updateFilterBarState();
}

function populateSelect(selectElement, items, selectedValue, defaultLabel) {
  // Built with createElement/textContent rather than innerHTML so option
  // text is never parsed as markup, even if a parser label ever
  // contained angle brackets.
  selectElement.textContent = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = defaultLabel;
  selectElement.appendChild(placeholder);
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

  // German pre-pass: a student's German group number is assigned by German
  // level and is usually NOT the same as their main tutorial/practical
  // group number. The old rule only let the German level match when no
  // tutorial was selected, so the moment a student picked their (required)
  // tutorial group, their German row matched neither the tutorial rule
  // (different number) nor the level rule (blocked) and silently vanished
  // ("German not going in German"). Now: if the selected tutorial group
  // happens to match a German room at the selected level we keep the tight
  // one-room narrowing; otherwise the level widens to every row of that
  // German level so the class is always shown.
  let germanNarrowedByTutorial = false;
  if (selection.german && selectedTutorialParsed) {
    germanNarrowedByTutorial = rawSlots.some(slot =>
      isGermanLevelSlot(slot, selection.german) &&
      matchesSelectedTutorialGroup(slot.groups || [], selectedTutorialParsed)
    );
  }

  return rawSlots.filter(slot => {
    // 1. Lectures ALWAYS show, regardless of selections. Three successive
    // rounds of "which major is this lecture for" guessing (course prefix,
    // row tag, then both) each still hid lectures the student actually
    // attends on the real portal — untagged faculty-prefix rows, cross-
    // listed rows filed under another major, combined cohorts like
    // "IET & MET" — and the symptom flipped around depending on which
    // tutorial was selected ("lectures removed when I choose a tut").
    // Missing a class is far worse than seeing a cohort-mate's lecture,
    // so cohort lectures (and anything else typed Lecture) pass
    // unconditionally; the dropdowns only filter tutorials/German/
    // electives.
    if (slot.isCohort) return true;
    // The type-Lecture guard must not swallow German/elective rows that
    // happen to sit in a hall room (e.g. "CPS402 T031 H8" is typed Lecture
    // by the H-room heuristic) — those are dropdown-filtered classes, not
    // cohort lectures. With nothing selected they stay out of the grid and
    // the generated PDF (v3.1).
    const primaryCategory = slot.group && slot.group.category;
    if (primaryCategory !== 'german' && primaryCategory !== 'elective' &&
        (slot.type || '').toLowerCase().includes('lecture')) return true;

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
    // tutorial tag identifies the student's room. The course comparison is
    // normalized: the portal renders the code with a space ("DE 303") in
    // the same style as "ELCT 708", so a raw === never matched.
    if (selection.german) {
      if (groups.some(g => g.category === 'german' && g.level === selection.german)) return true;
      if (normalizeCourseCode(slot.course) === selection.german) {
        // Only suppress the sibling rooms when the tutorial selection is
        // actually narrowing THIS level to one room; otherwise (student's
        // German group differs from their main tutorial group) show every
        // room of the level rather than none.
        if (!germanNarrowedByTutorial) return true;
      }
    }

    // 4. Elective/Humanities matching (token-based; elective rows have not
    // been validated against real portal markup yet).
    if (selection.elective) {
      if (groups.some(g => g.category === 'elective' && (g.track + (g.number || '')) === selection.elective)) return true;
    }

    return false;
  });
}

// True when this slot is one of the rows belonging to the given German
// level — either its course code IS the level (real-portal shape) or it
// carries a german-category token (legacy/synthetic shape).
function isGermanLevelSlot(slot, level) {
  if (normalizeCourseCode(slot.course) === level) return true;
  return (slot.groups || []).some(g => g.category === 'german' && g.level === level);
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
  const hasData = state.rawSlots.length > 0;
  const hasVisible = filteredSlots.length > 0;

  // Three mutually exclusive main views: no data at all (empty state),
  // data but the filters match nothing (no-match state), or the grid.
  if (elements.emptyState) elements.emptyState.classList.toggle('hidden', hasData);
  if (elements.noMatchState) elements.noMatchState.classList.toggle('hidden', !hasData || hasVisible);
  elements.gridMatrix.classList.toggle('hidden', !hasData || !hasVisible);
  if (!hasData || !hasVisible) return;

  elements.gridMatrix.innerHTML = '';
  elements.gridMatrix.setAttribute('aria-rowcount', String(WORKING_DAYS.length + 1));
  elements.gridMatrix.setAttribute('aria-colcount', String(PERIODS.length + 1));

  // 1. Header: Top-left Corner Cell
  const cornerCell = document.createElement('div');
  cornerCell.className = 'grid-cell header-cell corner-cell cell-anim';
  cornerCell.setAttribute('role', 'columnheader');
  cornerCell.innerHTML = '<strong>Day</strong><span>Periods</span>';
  elements.gridMatrix.appendChild(cornerCell);

  // 2. Header: Period Labels (1 to 5) with exact timings
  PERIODS.forEach((p, colIdx) => {
    const pCell = document.createElement('div');
    pCell.className = 'grid-cell header-cell cell-anim';
    pCell.setAttribute('role', 'columnheader');
    pCell.setAttribute('aria-colindex', colIdx + 2);
    pCell.innerHTML = `<strong>${p.label}</strong><span class="period-time">${p.start} - ${p.end}</span>`;
    elements.gridMatrix.appendChild(pCell);
  });

  // 3. Build Matrix Rows for Each Working Day (Saturday first)
  WORKING_DAYS.forEach((day, rowIdx) => {
    // Staggers each day's row in by a small delay so the grid feels like
    // it settles into place instead of popping in all at once.
    const rowDelay = `${(rowIdx + 1) * 30}ms`;

    const dayLabelCell = document.createElement('div');
    dayLabelCell.className = 'grid-cell day-header-cell cell-anim';
    dayLabelCell.setAttribute('role', 'rowheader');
    dayLabelCell.setAttribute('aria-rowindex', rowIdx + 2);
    dayLabelCell.style.animationDelay = rowDelay;
    dayLabelCell.innerHTML = `<span>${day}</span>`;
    if (day === TODAY_NAME) dayLabelCell.classList.add('day-today');
    elements.gridMatrix.appendChild(dayLabelCell);

    PERIODS.forEach((period, colIdx) => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell matrix-slot cell-anim';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-rowindex', rowIdx + 2);
      cell.setAttribute('aria-colindex', colIdx + 2);
      cell.style.animationDelay = rowDelay;

      const matchingSlots = filteredSlots.filter(s => s.day === day && s.period === period.id);

      if (matchingSlots.length === 0) {
        cell.classList.add('slot-free');
        cell.innerHTML = '<span class="free-indicator">Free</span>';
      } else {
        // Every card is always in the DOM: the cell scrolls internally when
        // crowded (the pre-v4 "slider" behavior, kept deliberately), and the
        // sticky "+N more" chip both flags the overflow and expands the cell
        // to show everything at once without scrolling.
        matchingSlots.forEach(slot => {
          cell.appendChild(createSlotCard(slot));
        });

        const hiddenCount = matchingSlots.length - MAX_VISIBLE_CARDS;
        if (hiddenCount > 0) {
          cell.classList.add('has-more');
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'more-chip';
          chip.dataset.hiddenCount = String(hiddenCount);
          chip.setAttribute('aria-expanded', 'false');
          chip.innerHTML =
            `<span class="more-chip-label">+${hiddenCount} more</span>` +
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
          cell.appendChild(chip);
        }
      }
      elements.gridMatrix.appendChild(cell);
    });
  });
}

function createSlotCard(slot) {
  const card = document.createElement('div');
  const typeKey = getBadgeTypeKey(slot);

  card.className = `slot-card badge-${typeKey}`;
  // title= gives a native tooltip on hover/focus so a course name that's
  // been truncated by the small card width is never fully hidden.
  card.title = `${slot.course} — ${slot.type}${slot.room ? ' — ' + slot.room : ''}`;
  card.innerHTML = `
    <div class="card-course">${escapeHTML(slot.course)}</div>
    <div class="card-meta">
      <span class="card-type">${TYPE_ICONS[typeKey] || ''}${escapeHTML(slot.type)}</span>
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
  // Real-portal German rows carry their level as the COURSE code while
  // their primary token is the row's own tutorial tag — without this check
  // they rendered with the tutorial badge (the "German shows up as a
  // tutorial" symptom). Normalized so spaced "DE 303" matches too.
  if (GERMAN_LEVELS.includes(normalizeCourseCode(slot.course))) return 'german';
  const typeLower = (slot.type || '').toLowerCase();
  if (typeLower.includes('lab')) return 'lab';
  return 'tut';
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ---------------------------------------------------------------------------
// PDF Export — the filtered matrix is drawn onto an offscreen canvas at
// print resolution, JPEG-encoded, and wrapped in a minimal hand-built
// single-page PDF (A4 landscape). No libraries: a PDF is just a header,
// five objects (catalog, pages, page, image XObject, content stream) and a
// cross-reference table, and JPEG bytes drop straight into an image object
// via the DCTDecode filter. buildPdfFromJpeg is pure bytes-in/bytes-out so
// the offline suite can verify the document structure without a canvas.
// ---------------------------------------------------------------------------

// A4 landscape in PDF points.
const PDF_PAGE_W = 842;
const PDF_PAGE_H = 595;
// Supersampling factor for the canvas render (sharper text when printed).
const PDF_SCALE = 2;

// Matches the popup's font stack so the PDF and the on-screen grid read
// consistently instead of the PDF falling back to plain Arial.
const PDF_FONT = "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

// Print-friendly light palette mirroring the popup's badge themes.
const PDF_BADGE_COLORS = {
  lecture:  { accent: '#0284c7', bg: '#e0f2fe', text: '#0c4a6e' },
  tut:      { accent: '#d97706', bg: '#fef3c7', text: '#78350f' },
  lab:      { accent: '#059669', bg: '#d1fae5', text: '#064e3b' },
  german:   { accent: '#9333ea', bg: '#f3e8ff', text: '#581c87' },
  elective: { accent: '#e11d48', bg: '#ffe4e6', text: '#881337' }
};

// A one-letter/short monogram per type, drawn as a small colored chip on
// each PDF card — mirrors the popup's colorblind-accessible type icons
// since the printed page has no room for real SVG icons.
const PDF_TYPE_MONOGRAM = {
  lecture: 'L',
  tut: 'T',
  lab: 'Lb',
  german: 'DE',
  elective: 'EL'
};

function generateAndDownloadPDF() {
  const filteredSlots = getFilteredSlots();
  if (!filteredSlots.length) {
    // handleExportClick screens for this before entering the busy state;
    // this throw only guards direct/programmatic calls.
    throw new Error('no classes in the current view');
  }

  const canvas = renderScheduleCanvas(filteredSlots);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpegBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  const pdfBytes = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height, PDF_PAGE_W, PDF_PAGE_H);

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  const label = (state.cohortName || state.selectedTutorial || 'Cohort').replace(/[^\w&+()-]+/g, '_');

  downloadAnchor.href = downloadUrl;
  downloadAnchor.download = `GUC_Schedule_${label}.pdf`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
  URL.revokeObjectURL(downloadUrl);
}

// Draws the full printable page — title block plus the 6-day x 5-period
// grid — into an offscreen canvas and returns it. Coordinates are PDF
// points; the context is pre-scaled by PDF_SCALE.
function renderScheduleCanvas(filteredSlots) {
  const canvas = document.createElement('canvas');
  canvas.width = PDF_PAGE_W * PDF_SCALE;
  canvas.height = PDF_PAGE_H * PDF_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(PDF_SCALE, PDF_SCALE);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PDF_PAGE_W, PDF_PAGE_H);

  const margin = 26;

  // Title block: cohort name (or generic title) + selection summary.
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 17px ${PDF_FONT}`;
  ctx.fillText(state.cohortName || 'GUC Semester Schedule', margin, margin + 16);

  const summaryParts = [];
  if (state.selectedTutorial) summaryParts.push(`Group ${state.selectedTutorial}`);
  if (state.selectedGerman) summaryParts.push(`German ${state.selectedGerman}`);
  if (state.selectedElective) summaryParts.push(`Elective ${state.selectedElective}`);
  summaryParts.push(`Generated ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  ctx.fillStyle = '#64748b';
  ctx.font = `9px ${PDF_FONT}`;
  ctx.fillText(summaryParts.join('   |   '), margin, margin + 34);

  // Grid geometry.
  const gridX = margin;
  const gridY = margin + 52;
  const dayColW = 104;
  const periodColW = (PDF_PAGE_W - margin * 2 - dayColW) / PERIODS.length;
  const headerRowH = 30;
  const dayRowH = (PDF_PAGE_H - gridY - headerRowH - margin) / WORKING_DAYS.length;

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;

  // Header row: corner cell + period labels with bell times.
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(gridX, gridY, dayColW + periodColW * PERIODS.length, headerRowH);
  drawPdfBoxLabel(ctx, gridX, gridY, dayColW, headerRowH, 'Day / Periods', `bold 8px ${PDF_FONT}`, '#64748b');
  ctx.strokeRect(gridX, gridY, dayColW, headerRowH);

  PERIODS.forEach((p, i) => {
    const x = gridX + dayColW + i * periodColW;
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 8.5px ${PDF_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.label, x + periodColW / 2, gridY + 13);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `7px ${PDF_FONT}`;
    ctx.fillText(`${p.start} - ${p.end}`, x + periodColW / 2, gridY + 23);
    ctx.textAlign = 'left';
    ctx.strokeRect(x, gridY, periodColW, headerRowH);
  });

  // Day rows.
  WORKING_DAYS.forEach((day, rowIdx) => {
    const y = gridY + headerRowH + rowIdx * dayRowH;

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(gridX, y, dayColW, dayRowH);
    drawPdfBoxLabel(ctx, gridX, y, dayColW, dayRowH, day, `bold 9px ${PDF_FONT}`, '#334155');
    ctx.strokeRect(gridX, y, dayColW, dayRowH);

    PERIODS.forEach((period, colIdx) => {
      const x = gridX + dayColW + colIdx * periodColW;
      const cellSlots = filteredSlots.filter(s => s.day === day && s.period === period.id);
      drawPdfSlotCell(ctx, x, y, periodColW, dayRowH, cellSlots);
      ctx.strokeRect(x, y, periodColW, dayRowH);
    });
  });

  return canvas;
}

function drawPdfBoxLabel(ctx, x, y, w, h, text, font, color) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawPdfSlotCell(ctx, x, y, w, h, slots) {
  if (!slots.length) {
    drawPdfBoxLabel(ctx, x, y, w, h, 'Free', `bold 8px ${PDF_FONT}`, '#9ca3af');
    return;
  }

  const pad = 4;
  const gap = 3;
  const cardH = Math.max(13, Math.min(30, (h - pad * 2 - gap * (slots.length - 1)) / slots.length));

  slots.forEach((slot, i) => {
    const cardY = y + pad + i * (cardH + gap);
    if (cardY + cardH > y + h - pad + 1 && i > 0) return; // don't overflow the cell
    const typeKey = getBadgeTypeKey(slot);
    const colors = PDF_BADGE_COLORS[typeKey] || PDF_BADGE_COLORS.tut;
    const monogram = PDF_TYPE_MONOGRAM[typeKey] || '';
    const cardX = x + pad;
    const cardW = w - pad * 2;

    pathRounded(ctx, cardX, cardY, cardW, cardH, 4);
    ctx.fillStyle = colors.bg;
    ctx.fill();
    ctx.fillStyle = colors.accent;
    ctx.fillRect(cardX, cardY, 3, cardH);

    ctx.fillStyle = colors.text;
    if (cardH >= 22) {
      ctx.font = `bold 7.5px ${PDF_FONT}`;
      ctx.fillText(fitText(ctx, slot.course, cardW - 12), cardX + 7, cardY + 10);

      // Type row: a small colored monogram chip (matching the popup's type
      // icon) sits before the type label, so the class type is legible on
      // a printed page even without color vision.
      const typeY = cardY + cardH - 5;
      let typeX = cardX + 7;
      if (monogram) {
        const chipW = monogram.length > 1 ? 11 : 7;
        const chipH = 7;
        const chipY = typeY - chipH + 1;
        pathRounded(ctx, typeX, chipY, chipW, chipH, 2);
        ctx.fillStyle = colors.accent;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 5px ${PDF_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(monogram, typeX + chipW / 2, chipY + chipH - 1.5);
        ctx.textAlign = 'left';
        typeX += chipW + 3;
        ctx.fillStyle = colors.text;
      }
      ctx.font = `6px ${PDF_FONT}`;
      ctx.fillText(fitText(ctx, slot.type, cardW - (typeX - cardX) - 30), typeX, typeY);

      ctx.textAlign = 'right';
      ctx.font = `bold 6px ${PDF_FONT}`;
      ctx.fillStyle = colors.text;
      ctx.fillText(slot.room, cardX + cardW - 4, cardY + cardH - 5);
      ctx.textAlign = 'left';
    } else {
      ctx.font = `bold 6.5px ${PDF_FONT}`;
      ctx.fillText(fitText(ctx, `${slot.course} · ${slot.room}`, cardW - 12), cardX + 7, cardY + cardH / 2 + 2);
    }
  });
}

function pathRounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth) {
  text = String(text || '');
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length > 1 && ctx.measureText(text + '…').width > maxWidth) {
    text = text.slice(0, -1);
  }
  return text + '…';
}

// Wraps raw JPEG bytes into a minimal valid single-page PDF whose page is
// exactly one full-bleed image. Pure and synchronous so tests can assert
// on the byte structure (header, DCTDecode image, xref, trailer).
function buildPdfFromJpeg(jpegBytes, pixelWidth, pixelHeight, widthPt, heightPt) {
  const encoder = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = {};

  const push = (data) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const beginObject = (n, body) => {
    offsets[n] = offset;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push('%PDF-1.4\n');
  beginObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  beginObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  beginObject(3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] ` +
    '/Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>');

  offsets[4] = offset;
  push('4 0 obj\n<< /Type /XObject /Subtype /Image ' +
    `/Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB ` +
    `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  push(jpegBytes);
  push('\nendstream\nendobj\n');

  const contentStream = `q ${widthPt} 0 0 ${heightPt} 0 0 cm /Im1 Do Q`;
  beginObject(5, `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);

  const xrefOffset = offset;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const out = new Uint8Array(offset);
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}

// Offline test harness hook: lets tests/test-harness.html (and its Node
// runner) call the real filter engine without a chrome.* runtime.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeFilteredSlots, parseGroupKey, getBadgeTypeKey, buildPdfFromJpeg };
}
