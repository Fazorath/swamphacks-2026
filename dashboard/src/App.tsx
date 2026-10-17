import { useNodeIdentity } from "./useNodeIdentity";

const ROLE_LABELS = { sensor: "Sensor Node", hub: "Hub" } as const;

const PLACEHOLDER_AREAS = ["Map", "Readings", "Alerts", "Evacuation Plan"];

export function App() {
  const { identity, failed } = useNodeIdentity();
  return (
    <main>
      <header>
        <h1>Storm Shield</h1>
        <p>
          {identity
            ? `${identity.name} · ${ROLE_LABELS[identity.role]}`
            : failed
              ? "Node unreachable"
              : "Connecting…"}
        </p>
      </header>
      <div className="areas">
        {PLACEHOLDER_AREAS.map((title) => (
          <section key={title} aria-label={title}>
            <h2>{title}</h2>
            <p>Coming soon</p>
          </section>
        ))}
      </div>
    </main>
  );
}
