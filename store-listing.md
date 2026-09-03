# Chrome Web Store Listing — Copy/Paste Text

Everything below is ready to paste straight into the Developer Dashboard fields.
Nothing here needs editing unless you want to change the wording. Current as of
extension version **4.2.2**.

---

## Item name
```
GUC Timetable Matrix
```

## Short description (max 132 characters)
```
Turns your GUC portal schedule into a clean, color-coded weekly timetable with one-click PDF export. 100% local, no account.
```
(125 characters)

## Detailed description
```
GUC Timetable Matrix turns the cluttered, cohort-wide schedule on the GUC
student portal (apps.guc.edu.eg) into a personalized, color-coded 6-day
timetable — Saturday through Thursday, with one-click PDF export and a
group-code translator.

WHY YOU'LL LIKE IT

• One glance, whole week — your cohort's messy grid becomes a clean matrix
  with the exact GUC period times (08:15–17:15).
• Pick your group, see your classes — choose your Tutorial/Practical group,
  German level (DE101–DE404) and Elective track (AE, AS, SM, CPS, RPW) and
  the grid filters down to just your classes. One "Clear filters" click
  resets everything.
• Two layouts — a classic maximized view with roomy cards, or a compact
  minimized mode. The popup always opens full-size; your choice is
  remembered.
• Group-code translator — "5BI-017" becomes "Business Informatics — 5th
  Semester — Group 17", read from your own cohort page.
• Smart about the portal's quirks — stacked German tutorial sections,
  cross-listed lectures, mixed-case course codes, biweekly slots. Lectures
  never silently disappear, and your German class never gets filtered away.
• Export to PDF — one click downloads a clean A4-landscape copy of exactly
  what you see, titled with your cohort name and your selected groups.
• Works offline — your last successful scan stays cached, even after the
  portal session times out.

HOW IT WORKS

1. Log in to apps.guc.edu.eg and open your General Group Schedule page.
2. Click the extension icon — it reads the schedule automatically.
3. Pick your groups; export the PDF if you want a copy.

PRIVACY

Everything runs locally inside your own browser. There is no account, no
server, no analytics, and no network request of any kind built into the
extension. Your schedule data never leaves your machine.

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
*(Dashboard asks you yes/no questions about data collection — answer all "No")*

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

---

# Launch Announcement

## Long post (WhatsApp / Discord / LinkedIn)

```
🎉 It's live! I just shipped GUC Timetable Matrix — a free Chrome extension I
built because I got tired of squinting at the portal's schedule grid every
semester.

You know the drill: you open General Group Schedule and it shows EVERY
section for EVERY group in your cohort — rows stacked on rows, tiny fonts,
and no way to tell which tutorial is actually yours. This extension reads
that page and turns it into one clean, color-coded weekly matrix: your
tutorial, your German level, your electives — just YOUR classes, Saturday to
Thursday, with the real period times.

A few things I'm proud of:
🗓️ Two layouts — a big classic view and a compact mode, one click to switch
🔤 A group-code translator: 5BI-017 becomes "Business Informatics — 5th
   Semester — Group 17"
🧠 It actually understands the portal's weird markup — stacked German
   sections, cross-listed lectures, even mixed-case course codes
📄 One-click PDF export, titled with your cohort name
🔒 100% local: no account, no server, no tracking — your schedule never
   leaves your browser

It's free, needs zero setup (install → open the page → click the icon), and
it remembers your groups for next time.

Install it here: [PASTE CHROME WEB STORE LINK]

If you try it and it saves you even one schedule headache, tell a
batch-mate 🚀
```

## Short post (X / Twitter)

```
Shipped my first Chrome extension 🚀

GUC Timetable Matrix reads your GUC portal schedule and turns the
cohort-wide chaos into one clean, color-coded weekly grid — your tutorial,
German level and electives only, with one-click PDF export.

Free. No account. 100% local. Link 👇
```
