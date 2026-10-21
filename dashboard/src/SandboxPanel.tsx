import { useState } from "react";

import { Panel, type PanelControl } from "./Panel";
import type { SandboxNode, SandboxNodes } from "./useSandboxNodes";

const MIN_RANGE_KM = 0.1;
const MAX_RANGE_KM = 50;
const RANGE_STEP_KM = 0.1;

type Props = {
  sandbox: SandboxNodes;
  onSetRadioRange: (metres: number) => Promise<void>;
  // Whether the Hub has sent any Community Warning yet; until it has, nobody has heard one.
  warningSent: boolean;
  panel: PanelControl;
};

function hopsText(node: SandboxNode): string {
  if (node.role === "hub") return "Hub";
  if (node.hops === null) return "no path to Hub";
  return node.hops === 1 ? "1 hop to Hub" : `${node.hops} hops to Hub`;
}

function warningText(node: SandboxNode, warningSent: boolean): string {
  if (!warningSent) return "no warning yet";
  return node.heard_warning ? "heard the warning" : "has not heard the warning";
}

export function SandboxPanel({ sandbox, onSetRadioRange, warningSent, panel }: Props) {
  const [problem, setProblem] = useState<string | null>(null);
  const rangeKm = sandbox.radio_range_m / 1000;

  const change = async (km: number) => {
    setProblem(null);
    try {
      await onSetRadioRange(Math.round(km * 1000));
    } catch (error) {
      console.error(error);
      setProblem(`Could not set the radio range: ${(error as Error).message}`);
    }
  };

  return (
    <Panel label="Sandbox" {...panel}>
      <p className="sandbox-label">SIMULATED</p>
      <label className="sandbox-range">
        Radio range
        <input
          type="range"
          aria-label="Radio range"
          min={MIN_RANGE_KM}
          max={MAX_RANGE_KM}
          step={RANGE_STEP_KM}
          value={rangeKm}
          onChange={(event) => void change(Number(event.target.value))}
        />
        <output>{rangeKm.toFixed(1)} km</output>
      </label>
      {problem && <p role="alert">{problem}</p>}
      <ul aria-label="Sandbox Nodes" className="sandbox-nodes">
        {sandbox.nodes.map((node) => (
          <li key={node.id} className={node.hops === null ? "no-path" : undefined}>
            <strong>{node.name}</strong>
            <span>{hopsText(node)}</span>
            <span>{warningText(node, warningSent)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
