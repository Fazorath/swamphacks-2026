import { useState } from "react";

import type { EventClockFeed } from "./useEventClock";
import { usePolledJson } from "./usePolledJson";

type Phase = { id: string; label: string; event_t: number };
type ReplayPhases = { phases: Phase[]; internet_cue_event_t: number };

async function sendToReplay(action: string, body?: object): Promise<void> {
  const response = await fetch(`/api/replay/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) {
    const { detail } = await response.json().catch(() => ({ detail: undefined }));
    throw new Error(typeof detail === "string" ? detail : `Node API returned ${response.status}`);
  }
}

// The Hub Panel's Replay section. The Event clock it shows arrives by the header's poll, so a
// press shows up within a second.
export function ReplayControls({ eventClock }: { eventClock: EventClockFeed }) {
  const { clock, heard } = eventClock;
  const replayPhases = usePolledJson<ReplayPhases>("/api/replay/phases");
  const [problem, setProblem] = useState<string | null>(null);

  // Until the clock is heard, a Start button would suggest no replay is running when one may be.
  if (!heard) {
    return (
      <section aria-label="Replay controls">
        <h3>Replay</h3>
        <p role="status">Waiting for the Hub to answer</p>
      </section>
    );
  }

  const send = async (action: string, body?: object) => {
    setProblem(null);
    try {
      await sendToReplay(action, body);
    } catch (error) {
      console.error(error);
      setProblem(`Could not ${action} the replay: ${(error as Error).message}`);
    }
  };

  const currentPhase = clock
    ? replayPhases?.phases.filter((phase) => phase.event_t <= clock.event_t).at(-1)
    : undefined;
  const internetCueReached =
    clock !== null && replayPhases !== null && clock.event_t >= replayPhases.internet_cue_event_t;

  return (
    <section aria-label="Replay controls">
      <h3>Replay</h3>
      {internetCueReached && (
        <p role="status" className="internet-cue">
          Cut the internet now
        </p>
      )}
      <div className="actions">
        {clock === null && (
          <button type="button" onClick={() => send("start")}>
            Start
          </button>
        )}
        {clock?.state === "playing" && (
          <button type="button" onClick={() => send("pause")}>
            Pause
          </button>
        )}
        {clock?.state === "paused" && (
          <button type="button" onClick={() => send("resume")}>
            Resume
          </button>
        )}
        <button type="button" onClick={() => send("reset")}>
          Reset
        </button>
      </div>
      <ul className="phase-list">
        {replayPhases?.phases.map((phase) => (
          <li key={phase.id}>
            <button
              type="button"
              aria-current={phase.id === currentPhase?.id ? "step" : undefined}
              onClick={() => send("jump", { phase: phase.id })}
            >
              {phase.label}
            </button>
          </li>
        ))}
      </ul>
      {problem && <p role="alert">{problem}</p>}
    </section>
  );
}
