# 0008: Household Profile

**What to build:** A resident fills in a Household Profile on their phone once: home location (tapped on the map), housing type (site-built or mobile home/RV), and whether they need a special-needs or pet-friendly Shelter. It is still there next time they open the dashboard, and it never leaves their device.

**Blocked by:** 0005

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

## Decisions (from grilling)

- **Placement:** a "My household" button opens a slide-over form. "Set home on map" puts the map in pick mode.
- **Home precision:** the exact tapped lat/lon is stored. No fuzzing, no snapping; later tickets snap to a grid point when they need one.
- **Required fields:** home location and housing type. Housing type has no preselected value. Special-needs and pets default to off. An incomplete profile counts as missing.
- **Storage failure:** the profile stays in memory for the session and a banner says it won't be remembered. An unreadable or wrong-version stored value counts as missing, shows a banner and is not deleted.
- **Pick mode:** tap-only placement (no drag handle). Node marker popups are off while picking. A "Done" button leaves pick mode.
- **Shape:** `HouseholdProfile = { home: { lat, lon }, housing: "site-built" | "mobile-home-rv", needsSpecialNeedsShelter: boolean, needsPetFriendlyShelter: boolean }`, stored as one versioned JSON value (`version: 1`) under one key. The flags match the Shelter's `special_needs` and `pet_friendly` in `docs/specs/wire-formats.md`.
- **Code:** a pure `householdProfile.ts` (load, save, validate, delete over a storage object) wrapped by `useHouseholdProfile()` returning `{ profile | null, storageProblem | null, save, remove }`. Callers never see `localStorage`.

## Acceptance

- [ ] A Household Profile form (slide-over) with housing type, special-needs and pets, and the line "Stays on this device"
- [ ] Home location is set by tapping the map in pick mode; no address lookup; Node popups are off while picking and a "Done" button leaves pick mode
- [ ] Save is disabled until home location and housing type are set; an incomplete profile counts as missing
- [ ] The profile is stored only in the Viewer's browser storage and survives a reload
- [ ] The profile is never sent to any Node (no request carries it)
- [ ] Storage failure shows a visible message and the profile still works for the session; an unreadable stored value counts as missing, shows a message and is not deleted
- [ ] A distinct Home marker shows on the main map whenever a complete profile exists
- [ ] A "Delete my profile" button with a two-step in-panel confirm clears storage and returns to the "fill in your profile" prompt
- [ ] Vitest tests: saving and loading a profile round-trips; a missing profile prompts the resident to fill one in; an incomplete profile counts as missing; a storage failure shows the message; a `fetch` spy sees no request carrying any profile value after saving and a poll cycle
- [ ] All **Commands** pass
