# 0032: Theme, bundled fonts and icons

**What to build:** The dashboard takes its look from one theme file: raw palette values live only there, mapped to named color roles, and every component uses roles. IBM Plex Sans and Mono are bundled with the dashboard, and `lucide-react` is the only icon source. The existing screen is recoloured and re-typeset with no layout change, so it already looks like the design and works with the internet unplugged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Visual language"); canvas artboards `F-Color`, `F-Type`, `F-Icons`; `docs/design/canvas/theme.css` is the starting copy of the theme.

- [ ] One theme file in `dashboard/src/` defines the primitives and every role listed in "Visual language"; no raw hex remains in any other stylesheet or component
- [ ] `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` (5.3.0) and `lucide-react` (1.49.0) are pinned dependencies; no request to Google Fonts or any other host is made
- [ ] Text uses Plex Sans, labels, tags and numbers use Plex Mono with tabular figures
- [ ] Contrast of text on its background is at least 7:1 (Unverified Nodes at least 4.5:1), checked against the table on `F-Color`
- [ ] Flood Risk is still always shown with its word, never colour alone
- [ ] Existing aria-labels the tests query are unchanged
- [ ] A test fails if a hex colour appears outside the theme file
- [ ] Manual check: with the page served by a Node and the internet off, the fonts and icons still load
- [ ] All **Commands** pass
