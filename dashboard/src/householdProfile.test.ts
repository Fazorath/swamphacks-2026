import { deleteProfile, loadProfile, saveProfile, type HouseholdProfile } from "./householdProfile";

const PROFILE: HouseholdProfile = {
  home: { lat: 29.6521, lon: -82.3244 },
  housing: "mobile-home-rv",
  needsSpecialNeedsShelter: false,
  needsPetFriendlyShelter: true,
};

const KEY = "storm-shield.household-profile";

beforeEach(() => localStorage.clear());

test("a saved profile loads back unchanged", () => {
  saveProfile(localStorage, PROFILE);
  expect(loadProfile(localStorage)).toEqual({ profile: PROFILE, unreadable: false });
});

test("nothing stored counts as missing without a problem", () => {
  expect(loadProfile(localStorage)).toEqual({ profile: null, unreadable: false });
});

test("an incomplete profile counts as missing and is left in storage", () => {
  const incomplete = JSON.stringify({ version: 1, profile: { ...PROFILE, housing: null } });
  localStorage.setItem(KEY, incomplete);
  expect(loadProfile(localStorage)).toEqual({ profile: null, unreadable: true });
  expect(localStorage.getItem(KEY)).toBe(incomplete);
});

test("garbage and wrong-version values count as missing and are left in storage", () => {
  for (const stored of ["{not json", JSON.stringify({ version: 2, profile: PROFILE })]) {
    localStorage.setItem(KEY, stored);
    expect(loadProfile(localStorage)).toEqual({ profile: null, unreadable: true });
    expect(localStorage.getItem(KEY)).toBe(stored);
  }
});

test("deleting clears storage", () => {
  saveProfile(localStorage, PROFILE);
  deleteProfile(localStorage);
  expect(localStorage.getItem(KEY)).toBeNull();
});
