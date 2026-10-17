export type HouseholdProfile = {
  home: { lat: number; lon: number };
  housing: "site-built" | "mobile-home-rv";
  needsSpecialNeedsShelter: boolean;
  needsPetFriendlyShelter: boolean;
};

const STORAGE_KEY = "storm-shield.household-profile";
const STORED_VERSION = 1;

export type LoadedProfile = {
  profile: HouseholdProfile | null;
  // A stored value is there but unusable. It is left alone, not deleted.
  unreadable: boolean;
};

function validate(value: unknown): HouseholdProfile | null {
  if (typeof value !== "object" || value === null) return null;
  const { home, housing, needsSpecialNeedsShelter, needsPetFriendlyShelter } = value as Record<
    string,
    unknown
  >;
  if (typeof home !== "object" || home === null) return null;
  const { lat, lon } = home as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (housing !== "site-built" && housing !== "mobile-home-rv") return null;
  if (typeof needsSpecialNeedsShelter !== "boolean") return null;
  if (typeof needsPetFriendlyShelter !== "boolean") return null;
  return { home: { lat, lon }, housing, needsSpecialNeedsShelter, needsPetFriendlyShelter };
}

export function loadProfile(storage: Storage): LoadedProfile {
  const stored = storage.getItem(STORAGE_KEY);
  if (stored === null) return { profile: null, unreadable: false };
  try {
    const parsed = JSON.parse(stored);
    const profile = parsed?.version === STORED_VERSION ? validate(parsed.profile) : null;
    return { profile, unreadable: profile === null };
  } catch {
    // Not JSON at all, which counts the same as any other unusable value.
    return { profile: null, unreadable: true };
  }
}

export function saveProfile(storage: Storage, profile: HouseholdProfile): void {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORED_VERSION, profile }));
}

export function deleteProfile(storage: Storage): void {
  storage.removeItem(STORAGE_KEY);
}
