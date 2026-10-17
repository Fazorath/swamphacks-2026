import { useState } from "react";

import { deleteProfile, loadProfile, saveProfile, type HouseholdProfile } from "./householdProfile";

export type StorageProblem = "unreadable" | "unsaved";

export type HouseholdProfileState = {
  profile: HouseholdProfile | null;
  storageProblem: StorageProblem | null;
  save: (profile: HouseholdProfile) => void;
  remove: () => void;
};

type Loaded = Pick<HouseholdProfileState, "profile" | "storageProblem">;

function loadFromBrowser(): Loaded {
  try {
    const { profile, unreadable } = loadProfile(window.localStorage);
    return { profile, storageProblem: unreadable ? "unreadable" : null };
  } catch (error) {
    console.error(error);
    return { profile: null, storageProblem: "unsaved" };
  }
}

export function useHouseholdProfile(): HouseholdProfileState {
  const [state, setState] = useState<Loaded>(loadFromBrowser);

  // The profile stays in memory even when the browser refuses to store it.
  const change = (profile: HouseholdProfile | null, write: () => void) => {
    try {
      write();
      setState({ profile, storageProblem: null });
    } catch (error) {
      console.error(error);
      setState({ profile, storageProblem: "unsaved" });
    }
  };

  return {
    ...state,
    save: (profile) => change(profile, () => saveProfile(window.localStorage, profile)),
    remove: () => change(null, () => deleteProfile(window.localStorage)),
  };
}
