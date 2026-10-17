import { useState } from "react";

import type { Registration } from "./nodeState";

type Props = {
  registration: Registration;
  // Polls now, so the status changes without waiting for the next poll.
  onSignedUp: () => void;
  onClose: () => void;
};

const STATUS_LINES: Record<Registration, string> = {
  unverified: "UNVERIFIED",
  waiting: "Sign-up sent, waiting for the Hub",
  registered: "REGISTERED",
};

export function NodePanel({ registration, onSignedUp, onClose }: Props) {
  const [problem, setProblem] = useState<string | null>(null);

  const signUp = async () => {
    setProblem(null);
    try {
      const response = await fetch("/api/registry/signup", { method: "POST" });
      if (!response.ok) throw new Error(`Node API returned ${response.status}`);
      onSignedUp();
    } catch (error) {
      console.error(error);
      setProblem(`Could not sign up: ${(error as Error).message}`);
    }
  };

  return (
    <aside role="dialog" aria-label="Node Panel" className="slide-over">
      <h2>Node</h2>
      <section aria-label="Registration">
        <h3>Registration</h3>
        <p>{STATUS_LINES[registration]}</p>
        {registration === "unverified" && (
          <button type="button" onClick={signUp}>
            Sign up with the Hub
          </button>
        )}
      </section>
      {problem && <p role="alert">{problem}</p>}
      <div className="actions">
        <button type="button" onClick={onClose}>
          Close panel
        </button>
      </div>
    </aside>
  );
}
