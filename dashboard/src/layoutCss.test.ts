import { readFileSync } from "node:fs";
import { join } from "node:path";

// Read from disk: Vitest turns every imported stylesheet into an empty string.
const css = readFileSync(join(import.meta.dirname, "App.css"), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.]/g, "\\.");
  const match = new RegExp(`(?:^|\\n\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`no rule for ${selector} in App.css`);
  return match[1];
}

describe("the Panel columns stay on screen", () => {
  it("sits each column 0.75rem inside its own edge of the stage", () => {
    expect(rule(".panel-column")).toMatch(/position:\s*absolute/);
    expect(rule(".panel-column.left")).toMatch(/left:\s*0\.75rem/);
    expect(rule(".panel-column.right")).toMatch(/right:\s*0\.75rem/);
  });

  it("keeps the page from gaining a sideways scroll bar from the status strip", () => {
    expect(rule(".status-strip")).toMatch(/overflow:\s*hidden/);
  });

  it("collapses the right column to its headings before the map gets too narrow", () => {
    expect(css).toMatch(
      /@media \(48rem < width < 56\.25rem\)\s*\{[^@]*\.panel-column\.right \.panel-body\s*\{\s*display:\s*none/,
    );
  });
});
