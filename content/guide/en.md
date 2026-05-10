# Guide

A short walk through how foray works, what it does for you, and how to use it well.

---

## What foray is (and isn't)

foray is a campaign room for your job hunt. You walk in every morning, see what's moving, decide your next move, walk out. It's a place — not a tracker.

A tracker is passive. You log into it and feed it. foray is the opposite: it watches your inbox, captures the new applications you start, and surfaces the small handful of decisions waiting on you. The rest stays out of your way.

---

## Your morning, in 3 minutes

Open the **Today** page. Three sections, in order of pressure:

1. **Decisions** — items waiting on you. Offers without an answer; emails the classifier wasn't sure about. One click confirms a classification; a second click opens the full foray.
2. **Today's interviews** — anything on the calendar for today, pulled from the stages you've added to your forays.
3. **Quiet** — forays where nothing has moved in more than 7 days. Not red, not loud — just a list to scan in case you want to nudge someone.

The sidebar always shows your **pipeline counts** — applied, screening, interviewing, offer, closed. You can stop reading the second you've seen what you need.

---

## Capture a foray

Three ways, depending on context:

- **From anywhere — ⌘K**. Opens a quick-capture modal with company, role, and URL. Use this when you're already inside the app.
- **The bookmarklet**. Drag it from Settings to your bookmarks bar. Click it on any job posting page; the title, URL, and any selected text get pre-filled into a new foray.
- **The full form** at `/applications/new`. Same fields plus salary range, location, source, notes. Use when you want to capture deliberately.

You don't need to fill in everything at capture time. Add stages, notes, and the rest from the foray's detail page.

---

## Connect Gmail (and why)

In Settings, hit **Connect Gmail**. The OAuth screen will ask for read access to your inbox.

Here's what happens after you connect:

- A cron job polls Gmail every 15 minutes.
- Each new email gets classified — *rejection*, *interview invite*, *recruiter outreach*, *noise*, or *unmatched*.
- High-confidence classifications (≥85%) automatically update the matching foray's status. You see them in the timeline.
- Low-confidence ones go to the **review queue** in `/inbox`, plus the top three show up on the Today page.

**What gets stored**: subject, sender, and a 500-character excerpt of each email. The full body is fetched on demand when you open a row in `/inbox`.

**The 7-day caveat**: while Gmail OAuth is in Test mode, Google may revoke the refresh token after seven days. If sync goes stale, Settings shows a warning banner and you reconnect.

---

## The review queue

When the classifier isn't sure, the email lands in `/inbox` with its best guess and confidence percent. You have four actions per row:

- **Confirm** — accept the classifier's label. The foray's status updates.
- **Override** — pick the right label from a dropdown.
- **Link to foray** — if the classifier didn't match a foray and you know which one it belongs to.
- **Ignore** — mark as noise, don't touch any foray.

Empty queue = you're caught up. The Today page reflects that with a calmer tone.

---

## Stages vs canonical status

Two layers of status, deliberately:

- **Canonical status** is one of six fixed states: applied, screening, interviewing, offer, rejected, withdrawn. Used for filters, kanban columns, the pipeline strip — anywhere you compare across forays.
- **Stages** are free-form per foray. "Recruiter call", "Tech round 2", "Bar raiser", "On-site". Different companies run interviews differently; stages let you record what's actually happening.

A foray can be in canonical status `interviewing` while its current stage is "Tech round 2 of 3". The two answer different questions: status is "where in the pipeline?", stage is "where in this specific company's process?".

---

## Power moves

- **⌘K** from anywhere → quick-capture modal
- **Click a board card** → foray detail with timeline + notes
- **Filter by status** on `/applications` → URL is the source of truth, share the link to share the filter
- **Toggle Board / List** on `/applications` → board for visual scanning, list for sorting by date
- **Language** in Settings → English / Tiếng Việt / Bahasa Indonesia. Job content stays in source language; only the chrome translates.

---

## What foray won't do

Honest limits, set early:

- **Won't apply for you.** Capture is one-click; the application itself is your job.
- **Won't motivate you.** No streaks, no dopamine loops, no "you've got this" copy. The product gives you receipts; the motivation is yours.
- **Won't ghost-track companies you didn't apply to.** Every foray is one you started.
- **Won't store full email bodies indefinitely.** Excerpts only, full bodies fetched on demand. Privacy first.
- **Won't pretend the classifier is always right.** Anything below 85% confidence sits in the review queue with the percent shown — you can see what the model thought and decide.

That's it. Open the [Today page](/today) and have a look.
