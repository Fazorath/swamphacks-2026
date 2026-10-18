# 0079: The right Panel column stays on screen

**What to build:** On the owner's browser window the right Panel column (Alerts, Evacuation Plan, Cameras) ran off the right edge, so the Panels were cut off. At every desktop width the right column sits fully inside the window, 12 px from the edge, and the Panels never push the page sideways.

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("Layout"); decisions `docs/design/gods-eye-view-decisions.md` (D-50); canvas artboard `G-National-Calm`.

- [x] Find the cause on the owner's window (the screenshot shows the Panel headings starting at the right edge with their chevrons cut off) and fix it; note the cause here
  - **Cause found only in part (2026-10-18):** the exact cut-off could not be reproduced. In headless Chrome the columns were already 12 px inside the window at 820 to 1920 px, collapsed or expanded. What did go wrong below 960 px: the Status Strip's nowrap items add up to 960 px and widened the page sideways (`scrollWidth` 960 in an 820 px window), so a narrower window scrolled the page and put the right column partly out of view. The strip now clips (`overflow: hidden`), and `scrollWidth` equals the window width at every width tried. If the owner still sees the cut-off, ask for their window width and browser zoom.
- [x] At 1280, 1440 and 1920 px wide the right column's right edge is 12 px inside the window and the left column's left edge is 12 px inside it; there is no horizontal scroll bar on the page
- [x] A window too narrow for both columns and a usable map (under about 900 px) keeps the columns on screen, collapsing the right one to its headings first
- [x] A test fails when the layout CSS puts a Panel column outside the viewport (a stylesheet-reading test like `theme.test.ts`, or a computed-style check in a real browser, noted here)
  - `dashboard/src/layoutCss.test.ts` reads `App.css`. Measured rects in headless Chrome through DevTools at 1280, 1440, 1920, 880 and 820 px: left column 12 to 300, right column 12 px inside the right edge.
- [x] Checked by hand in Chrome on the demo laptop at those widths, with a screenshot noted here
  - The owner looked at the dashboard in their own Chrome window on 2026-10-18 and confirmed the Panels are on screen. Headless screenshots only; no screenshot of the owner's window was saved.
- [x] All **Commands** pass

**Notes:** found in the 0033 review screenshot. The columns are `.panel-column.left` and `.panel-column.right` in `App.css`, positioned absolutely over `.stage`; check the width of `main` and any scroll bar the page gains before blaming the columns themselves.
