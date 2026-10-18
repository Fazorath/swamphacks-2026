import { ShieldCheck, ShieldQuestionMark, UserPlus } from "lucide-react";
import { useState } from "react";

type RegistryRow = {
  id: string;
  name: string | null;
  status: "registered" | "waiting" | "unverified";
  last_heard_s: number | null;
};

// The answer of the Hub's GET /api/registry.
export type RegistrySummary = { ver: number; nodes: RegistryRow[] };

const STATUS_TAGS = {
  registered: { label: "REGISTERED", icon: ShieldCheck },
  waiting: { label: "SIGN-UP WAITING", icon: UserPlus },
  unverified: { label: "UNVERIFIED", icon: ShieldQuestionMark },
} as const;

function heardAgo(seconds: number | null): string {
  if (seconds === null) return "not heard";
  const rounded = Math.ceil(seconds);
  return rounded < 60 ? `heard ${rounded} s ago` : `heard ${Math.floor(rounded / 60)} min ago`;
}

export function RegistryTab({ registry }: { registry: RegistrySummary | null }) {
  const [accepting, setAccepting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // An accept shows its answer at once; the next poll replaces it with the Hub's current list.
  const [accepted, setAccepted] = useState<{ summary: RegistrySummary; polled: unknown } | null>(
    null,
  );
  const shown = accepted && accepted.polled === registry ? accepted.summary : registry;

  const accept = async (row: RegistryRow) => {
    setAccepting(true);
    setProblem(null);
    try {
      const response = await fetch("/api/registry/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      if (!response.ok) {
        const { detail } = await response.json().catch(() => ({ detail: undefined }));
        throw new Error(
          typeof detail === "string" ? detail : `Node API returned ${response.status}`,
        );
      }
      setAccepted({ summary: await response.json(), polled: registry });
    } catch (error) {
      console.error(error);
      setProblem(`Could not accept ${row.name ?? row.id}: ${(error as Error).message}`);
    } finally {
      setAccepting(false);
    }
  };

  if (!shown) return <p>Loading the registry…</p>;
  return (
    <section aria-label="Registry">
      <ul className="registry-list">
        {shown.nodes.map((row) => {
          const { label, icon: Icon } = STATUS_TAGS[row.status];
          return (
            <li key={row.id}>
              <strong>{row.name ?? "Unknown"}</strong>
              <code>{row.id}</code>
              <span className={`tag registry-${row.status}`}>
                <Icon size={14} aria-hidden="true" /> {label}
              </span>
              <span>{heardAgo(row.last_heard_s)}</span>
              {row.status === "waiting" && (
                <button
                  type="button"
                  disabled={accepting}
                  aria-label={`Accept ${row.name ?? row.id}`}
                  onClick={() => accept(row)}
                >
                  Accept
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {problem && <p role="alert">{problem}</p>}
    </section>
  );
}
