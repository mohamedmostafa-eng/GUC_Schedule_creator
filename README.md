# GUC Timetable Matrix Extension

A Manifest V3 Chrome extension that turns the cluttered, cohort-wide HTML
schedule on `apps.guc.edu.eg` into a personalized, color-coded 6-day
(Saturday–Thursday) timetable — with one-click `.ics` calendar export and a
built-in group-code translator.

**Cost: $0.** No account, no API key, no subscription, no credit card, ever.
Everything runs as a local script inside your own browser. Your GUC login
and schedule data never leave your machine — there is no server, no
analytics, and no network request of any kind built into this extension.

---

## What's new in v2.0.0

- **Saturday is back.** GUC's academic week is Saturday–Thursday; v1 had a
  bug where Saturday classes were scraped correctly but silently dropped
  from the rendered grid and `.ics` export. Fixed at the root: day/period
  constants now live in one shared file (`shared-constants.js`) instead of
  two separate, hand-copied arrays that could drift apart.
- **No more duplicate/junk entries.** Cells with a nested `<table>` (common
  for multi-line slots) used to get parsed twice — once correctly, once as
  meaningless "GENERAL"/"TBA" noise. The parser now does a proper two-pass
  extraction so each cell yields exactly the slots that are actually there.
- **Tutorial and Practical sections are unified.** `T041` and `P041` are
  recognized as the same section (a tutorial/practical pairing sharing one
  group number), not two separate lookups.
- **Real German/elective categories.** German is exactly 4 levels
  (`DE101`–`DE404`); electives/humanities are exactly 5 tracks (`AE`, `AS`,
  `SM`, `CPS`, `RPW`). The dropdowns and classification logic are built
  around these lists instead of guessing from substrings.
- **Group-code translator.** Pick a tutorial/practical group and the popup
  shows a plain-English decode underneath the dropdown, e.g.
  *"Mechatronics Engineering — 5th Semester — Group 41."*
- **Cohort lectures no longer bleed across majors.** A wide, ungrouped
  lecture cell is now matched against the major implied by your selected
  tutorial/practical group, so another department's cross-listed lecture
  doesn't show up in your grid.
- **No more overflowing cells.** When 3+ classes collide in one time slot
  (e.g. alternating labs), the cell now scrolls internally at a fixed
  height instead of expanding and bleeding into the row below.

---

## 1. What's in this repo

```
guc-timetable-matrix/
├── manifest.json           # Manifest V3 config
├── shared-constants.js     # Single source of truth: days, periods, German/elective lists
├── content.js               # DOM parser — reads the schedule table on the page
├── icons/                   # Toolbar icons (16/48/128px)
├── popup/
│   ├── popup.html           # Popup UI shell
│   ├── popup.js               # State, rendering, filtering, translator, .ics export
│   └── popup.css               # Dark theme + print stylesheet
├── tests/
│   ├── test-harness.html    # Browser test page (button → assertions + raw JSON)
│   ├── node-runner.js       # Headless runner for the exact same suite (`npm test`)
│   ├── fixtures.js          # Fixture markup: synthetic machinery shapes + REAL-PORTAL transcripts
│   └── run-tests.js         # Shared assertions: parser + the real popup filter engine
└── package.json             # Dev-only (jsdom) for headless tests — the extension itself needs no build
```

---

## 2. Install it (2 minutes, free, no dev account needed)

Chrome extensions installed this way ("sideloading") never require the
$5 one-time Chrome Web Store developer fee, a Google Play/Apple account,
or any payment info — you're just pointing your own browser at a folder
on your own disk.

1. **Get the files onto your computer.** Download and unzip
   `guc-timetable-matrix.zip` anywhere you like (Desktop, Documents, etc).
   Keep the folder — don't delete it after installing, Chrome reads the
   files live from that location.
2. **Open the extensions page.** In Chrome (or any Chromium browser —
   Edge, Brave, Opera all work the same way), go to `chrome://extensions/`.
3. **Turn on Developer mode.** Toggle it on in the top-right corner.
4. **Click "Load unpacked".** Select the `guc-timetable-matrix` folder
   (the one containing `manifest.json`, not a parent folder).
5. **Pin it.** Click the puzzle-piece icon in Chrome's toolbar and pin
   "GUC Timetable Matrix" so it's always one click away.

That's it — no restart needed.

---

## 3. Use it

1. Log in to `apps.guc.edu.eg` and navigate to your general schedule page:

   **https://apps.guc.edu.eg/student_ext/Scheduling/GeneralGroupSchedule.aspx**

   (the one showing the full cohort grid with First/Second/.../Fifth
   Period columns). The extension is scoped specifically to pages under
   `apps.guc.edu.eg/student_ext/` — it won't run anywhere else.
2. Click the extension icon in your toolbar.
3. The popup automatically scans the page and shows a status badge:
   - **Synced Live** — it read the table successfully.
   - **GUC Tab Not Detected** — you're not on the schedule page in the
     active tab. Click the **Open my GUC schedule →** link in the error
     banner to jump straight there, then click **Force Re-scan**.
   - **Table Not Found** — you're on the right site but the schedule
     table isn't visible yet (still loading, or you're on a different
     page of the portal). Wait for the page to fully load and re-scan.
4. Use the three dropdowns to pick your specific groups:
   - **Tutorial / Practical Group** — selecting a group also fills in a
     one-line, plain-English decode underneath (major, semester, group
     number).
   - **German Level** — one of the 4 official levels (`DE101`–`DE404`).
   - **Elective / Humanities** — one of the 5 tracks (`AE`, `AS`, `SM`,
     `CPS`, `RPW`).
   The grid instantly filters down to just your classes; your picks are
   remembered for next time.
5. Click **Export .ics** to download a calendar file. Import it into
   Google Calendar, Apple Calendar, or Outlook — it creates 14 weeks of
   recurring events on the correct weekdays (Saturday included), anchored
   to your device's current date, using the exact GUC period bells:

   | Period | Time |
   |---|---|
   | 1st | 08:15 – 09:45 |
   | 2nd | 10:00 – 11:30 |
   | 3rd | 11:45 – 13:15 |
   | 4th | 13:45 – 15:15 |
   | 5th | 15:45 – 17:15 |

6. Even if the portal session later times out, your last successful scan
   stays cached (`chrome.storage.local`), so the popup keeps working
   offline until you next click Force Re-scan.

### Importing the .ics file
- **Google Calendar (web):** Settings → Import & export → Select file
  from your computer → pick the downloaded `.ics` → Import.
- **Apple Calendar (Mac):** double-click the downloaded `.ics` file.
- **Outlook:** File → Open & Export → Import/Export → Import an iCalendar
  file.

### Changing the export start date
By default, exports anchor to the *next upcoming* occurrence of each
weekday from today, so events always land on real, current calendar
dates. If your semester's actual start date is different and you want
the very first event to fall in a specific week, open `popup/popup.js`
and adjust the `computeUpcomingWeekDates()` function.

---

## 4. Test it without logging into the live portal

Because the portal's HTML structure can vary (nested tables, merged
cells, stacked per-group rows), the parser and the popup's filter engine
are both pinned down by an offline suite that runs two ways:

- **In a browser:** open `tests/test-harness.html` (double-click it — no
  server needed) and click **Run Parser & Filter Tests**. You get a
  pass/fail assertion summary plus the raw structured JSON the parser
  produced.
- **Headless:** `npm install` once (dev-only dependency jsdom), then
  `npm test`. Same fixture, same assertions, exit code 1 on any failure.

The fixture markup in `tests/fixtures.js` deliberately separates two
classes of input:

- **Synthetic shapes** — hand-built cells covering the extraction
  machinery: nested tables, `rowspan`/`colspan` period mapping, all 4
  German levels, all 5 elective tracks, a compound cross-faculty tag.
  These don't claim to mirror the real portal; they pin down mechanics.
- **Real-portal transcripts** — markup copied verbatim from the live
  schedule page (right-click a period cell → Inspect → Copy outerHTML):
  per-group stacked tutorial rows (`DE303 Tut | C2.105 | 3 MET III 3G
  T016`, nine rows in one cell), `<font>`-wrapped columns, and the
  hidden svgjs `<svg>` scaffolding browser extensions inject into rows.
  These pin down actual portal behavior. **If the portal's markup
  changes, re-copy a fresh paste — don't edit these from memory.**

To test against your *actual* portal markup: copy a period cell's
outerHTML as above and add it to `tests/fixtures.js` (mark it
real-portal), then add assertions for what it should produce in
`tests/run-tests.js` and run `npm test`. This lets you debug parsing
issues offline, repeatedly, without re-triggering portal logins.

---

## 5. Known limitations (please read before relying on this for exam scheduling)

The parser works by pattern-matching text in each table cell, since the
GUC portal doesn't expose structured data — this is inherently a bit
fuzzy. A few edge cases to be aware of:

- **Compound cross-faculty tags** (e.g. `3 IET-8 & MET11 SM T011`): the
  extension prefers the most specific tag it finds (a German level or an
  elective track) over a generic fragment, but with enough faculties
  combined in one cell, the picked tag may still not be the one you
  expect. Check the "Force Re-scan" output against the raw portal table
  if a slot looks off.
- **Elective registration has not been validated against real markup
  yet.** German-course rows are (the DE level is registered from the
  course code itself, validated against a real portal paste). Elective
  registration still relies on an AE/AS/SM/CPS/RPW token appearing in the
  cell text — if a real portal paste shows elective course rows use the
  same stacked per-group layout as German, they'll need the same
  course-code registration treatment. Paste a real elective cell into
  `tests/fixtures.js` first.
- **Cohort-lecture major matching is a heuristic.** When a cohort lecture
  cell carries no explicit group tag, its major is guessed from the
  course code's letter prefix (e.g. `ELCT` from `ELCT501`). If your
  faculty's course codes don't follow that pattern, a cohort lecture
  might not get filtered the way you expect — it will still be *shown*,
  just possibly alongside a lecture from a different major.
- **The faculty/major name dictionary in `shared-constants.js`
  (`MAJOR_NAMES`) is not exhaustive.** Unrecognized major codes still
  decode structurally (semester, group number) in the translator, just
  without a friendly major name. Feel free to add your own entries.

Always double check your first generated timetable against the official
portal before your first week of classes, and open an issue (or just
edit `content.js`/`shared-constants.js` yourself — it's plain, commented
JavaScript) if your faculty uses a schedule format not covered by the
regexes.

---

## 6. Updating / re-packaging the extension

Since this is unpacked/sideloaded, there's no build step required —
Chrome reads the raw files. To make changes:

1. Edit the files directly in the unzipped folder.
2. Go to `chrome://extensions/` and click the refresh icon on the GUC
   Timetable Matrix card (or toggle it off/on) to reload your changes.
3. Reload your GUC portal tab, then re-open the popup.

If you want to share your modified version as a zip with someone else:
- **macOS/Linux:** `cd guc-timetable-matrix && zip -r ../guc-timetable-matrix.zip .`
- **Windows:** right-click the `guc-timetable-matrix` folder → Send to →
  Compressed (zipped) folder.

No build tooling, npm install, or paid packaging service is required at
any point.

---

## 7. Uninstalling

Go to `chrome://extensions/`, find "GUC Timetable Matrix", and click
**Remove**. This also clears its local storage cache automatically.

---

## 8. Privacy

- No external servers, analytics, or third-party API calls of any kind.
- `host_permissions` are scoped strictly to `*://apps.guc.edu.eg/student_ext/*`
  — the extension cannot read or run on any other site, including other
  areas of the GUC portal outside the student scheduling section.
- All cached schedule/group data lives in `chrome.storage.local`, which
  is local to your browser profile and never synced anywhere by this
  extension.
