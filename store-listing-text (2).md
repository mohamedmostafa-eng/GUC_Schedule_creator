# Chrome Web Store Listing — Copy/Paste Text

Everything below is ready to paste straight into the Developer Dashboard fields.
Nothing here needs editing unless you want to change the wording.

---

## Item name
```
GUC Timetable Matrix
```

## Short description (max 132 characters)
```
Turns your GUC portal schedule into a personalized, color-coded timetable with one-click PDF export. No account needed.
```
(120 characters)

## Detailed description
```
GUC Timetable Matrix turns the cluttered, cohort-wide schedule on the GUC
student portal (apps.guc.edu.eg) into a personalized, color-coded 6-day
timetable — with one-click PDF export and a built-in group-code translator.

HOW IT WORKS
1. Log in to apps.guc.edu.eg and open your General Group Schedule page.
2. Click the extension icon.
3. Pick your Tutorial/Practical group, German level, and Elective track from
   the dropdowns — the grid instantly filters to just your classes.
4. Click "Export PDF" to download a clean, color-coded copy.

PRIVACY
Everything runs locally inside your own browser. There is no external
server, no account, no analytics, and no network request of any kind built
into this extension. Your schedule data never leaves your machine. Full
privacy policy: [PASTE YOUR HOSTED PRIVACY POLICY URL HERE]

This is an independent, unofficial student project and is not affiliated
with or endorsed by the German University in Cairo.
```

## Category
```
Productivity
```

## Language
```
English
```

---

## Single purpose description
*(Dashboard asks: "What is the single purpose of this extension?")*
```
To read the schedule table on the user's own GUC student portal page and
display it as a personalized, filtered, color-coded timetable within the
extension's popup, with an optional local PDF export.
```

---

## Permission justifications
*(Dashboard asks you to justify each permission/host permission individually)*

**host_permissions — `*://apps.guc.edu.eg/student_ext/*`**
```
Required to read the schedule table rendered on the user's own GUC student
portal page (apps.guc.edu.eg/student_ext/) so it can be parsed and displayed
as a personalized timetable. The extension is scoped strictly to this path
and cannot access any other site, including other areas of the GUC portal.
```

**activeTab**
```
Used to read the schedule table from the currently active GUC portal tab
only when the user explicitly opens the extension popup or clicks
"Force Re-scan." No background or automatic access to tab content.
```

**storage**
```
Used to cache the user's last successfully scanned schedule and their
dropdown selections (tutorial group, German level, elective track) locally
via chrome.storage.local, so the popup keeps working without re-scanning
every time it's opened. Nothing is synced or sent externally.
```

**scripting**
```
Used to inject the schedule-parsing content script into a GUC portal tab
that was already open before the extension was last loaded/reloaded, so
"Force Re-scan" works without requiring the user to manually reload the tab.
```

---

## Data usage disclosure (Privacy practices tab)
*(Dashboard asks yes/no questions about data collection — answer all "No")*

- Does this item collect or use user data? → **No** (all processing is local; nothing is transmitted)
- If asked to elaborate: *"All schedule parsing and PDF generation happens locally in the browser. No data is collected, transmitted, sold, or shared with any third party."*

## Privacy policy URL field
```
https://mohamedmostafa-eng.github.io/GUC_Schedule_creator/privacy-policy.html
```

## Visibility
```
Unlisted (recommended) — installable only via direct link, avoids implying
official GUC endorsement. Switch to Public later if you want it searchable
in the Store.
```
