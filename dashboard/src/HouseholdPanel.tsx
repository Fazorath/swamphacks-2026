import { useState } from "react";

import type { HouseholdProfile } from "./householdProfile";

type Props = {
  profile: HouseholdProfile | null;
  home: HouseholdProfile["home"] | null;
  // Hidden while the map is in pick mode, but kept mounted so the form keeps what was typed.
  hidden: boolean;
  onPickHome: () => void;
  onSave: (profile: HouseholdProfile) => void;
  onDelete: () => void;
  onClose: () => void;
};

export function HouseholdPanel({
  profile,
  home,
  hidden,
  onPickHome,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [housing, setHousing] = useState<HouseholdProfile["housing"] | null>(
    profile?.housing ?? null,
  );
  const [needsSpecialNeedsShelter, setNeedsSpecialNeedsShelter] = useState(
    profile?.needsSpecialNeedsShelter ?? false,
  );
  const [needsPetFriendlyShelter, setNeedsPetFriendlyShelter] = useState(
    profile?.needsPetFriendlyShelter ?? false,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <aside role="dialog" aria-label="My household" className="slide-over" hidden={hidden}>
      <h2>My household</h2>
      <p className="privacy">Stays on this device</p>

      <p>{home ? `Home: ${home.lat.toFixed(5)}, ${home.lon.toFixed(5)}` : "Home: not set"}</p>
      <button type="button" onClick={onPickHome}>
        Set home on map
      </button>

      <fieldset>
        <legend>Housing type</legend>
        <label>
          <input
            type="radio"
            name="housing"
            checked={housing === "site-built"}
            onChange={() => setHousing("site-built")}
          />
          Site-built home
        </label>
        <label>
          <input
            type="radio"
            name="housing"
            checked={housing === "mobile-home-rv"}
            onChange={() => setHousing("mobile-home-rv")}
          />
          Mobile home / RV
        </label>
      </fieldset>

      <label>
        <input
          type="checkbox"
          checked={needsSpecialNeedsShelter}
          onChange={(event) => setNeedsSpecialNeedsShelter(event.target.checked)}
        />
        We need a special-needs Shelter
      </label>
      <label>
        <input
          type="checkbox"
          checked={needsPetFriendlyShelter}
          onChange={(event) => setNeedsPetFriendlyShelter(event.target.checked)}
        />
        We need a pet-friendly Shelter
      </label>

      <div className="actions">
        <button
          type="button"
          disabled={home === null || housing === null}
          onClick={() => {
            if (home === null || housing === null) return;
            onSave({ home, housing, needsSpecialNeedsShelter, needsPetFriendlyShelter });
            onClose();
          }}
        >
          Save
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {profile &&
        (confirmingDelete ? (
          <div className="actions">
            <span>Delete your profile from this device?</span>
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              Yes, delete
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingDelete(true)}>
            Delete my profile
          </button>
        ))}
    </aside>
  );
}
