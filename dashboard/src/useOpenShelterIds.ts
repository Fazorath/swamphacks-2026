import { useCallback, useEffect, useRef, useState } from "react";

const POLL_EVERY_MS = 5000;

// The second value lets the Hub Panel show a change at once instead of waiting for the next poll.
// A failed poll keeps the last list, so a Wi-Fi blip never leaves the plan with nowhere to go;
// before the first answer nothing counts as open.
export function useOpenShelterIds(): [string[], (openIds: string[]) => void] {
  const [openIds, setOpenIds] = useState<string[]>([]);
  // A poll that began before a change would bring back the list the change replaced.
  const changesShown = useRef(0);
  useEffect(() => {
    const poll = () => {
      const changesBeforePoll = changesShown.current;
      const showIfCurrent = (ids: string[]) => {
        // The same list again is not stored, so a quiet poll re-renders nothing.
        if (changesShown.current === changesBeforePoll) {
          setOpenIds((current) =>
            current.length === ids.length && current.every((id, i) => id === ids[i])
              ? current
              : ids,
          );
        }
      };
      return fetch("/api/shelters")
        .then((response) => {
          if (!response.ok) throw new Error(`Node API returned ${response.status}`);
          return response.json();
        })
        .then(({ open }) => {
          if (!Array.isArray(open)) throw new Error("Node API sent no open Shelter list");
          showIfCurrent(open);
        })
        .catch((error) => console.error(error));
    };
    poll();
    const timer = setInterval(poll, POLL_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  const showChange = useCallback((ids: string[]) => {
    changesShown.current += 1;
    setOpenIds(ids);
  }, []);
  return [openIds, showChange];
}
