import { useEffect, useState } from "react";

const POLL_EVERY_MS = 5000;

// The setter lets the Hub Panel show a change at once instead of waiting for the next poll.
export function useOpenShelterIds(): [string[], (openIds: string[]) => void] {
  const [openIds, setOpenIds] = useState<string[]>([]);
  useEffect(() => {
    const poll = () =>
      fetch("/api/shelters")
        .then((response) => {
          if (!response.ok) throw new Error(`Node API returned ${response.status}`);
          return response.json();
        })
        .then(({ open }) => {
          if (!Array.isArray(open)) throw new Error("Node API sent no open Shelter list");
          setOpenIds(open);
        })
        .catch((error) => {
          console.error(error);
          // Nothing counts as open until listed.
          setOpenIds([]);
        });
    poll();
    const timer = setInterval(poll, POLL_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  return [openIds, setOpenIds];
}
