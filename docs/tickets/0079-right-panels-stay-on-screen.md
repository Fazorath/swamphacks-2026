# 0079: The right Panel column stays on screen

**What to build:** On the owner's browser window the right Panel column (Alerts, Evacuation Plan, Cameras) ran off the right edge, so the Panels were cut off. At every desktop width the right column sits fully inside the window, 12 px from the edge, and the Panels never push the page sideways.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("Layout"); decisions `docs/design/gods-eye-view-decisions.md` (D-50); canvas artboard `G-National-Calm`.

- [ ] Find the cause on the owner's window (the screenshot shows the Panel headings starting at the right edge with their chevrons cut off) and fix it; note the cause here
- [ ] At 1280, 1440 and 1920 px wide the right column's right edge is 12 px inside the window and the left column's left edge is 12 px inside it; there is no horizontal scroll bar on the page
- [ ] A window too narrow for both columns and a usable map (under about 900 px) keeps the columns on screen, collapsing the right one to its headings first
- [ ] A test fails when the layout CSS puts a Panel column outside the viewport (a stylesheet-reading test like `theme.test.ts`, or a computed-style check in a real browser, noted here)
- [ ] Checked by hand in Chrome on the demo laptop at those widths, with a screenshot noted here
- [ ] All **Commands** pass

**Notes:** found in the 0033 review screenshot. The columns are `.panel-column.left` and `.panel-column.right` in `App.css`, positioned absolutely over `.stage`; check the width of `main` and any scroll bar the page gains before blaming the columns themselves.
