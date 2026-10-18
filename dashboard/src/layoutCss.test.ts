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
  it("sits each column inside its own edge of the stage, the left one clear of the rail", () => {
    expect(rule(".panel-column")).toMatch(/position:\s*absolute/);
    expect(rule(".panel-column.left")).toMatch(/left:\s*3\.75rem/);
    expect(rule(".panel-column.right")).toMatch(/right:\s*0\.75rem/);
  });

  it("keeps the page from gaining a sideways scroll bar from the status strip", () => {
    expect(rule(".status-strip")).toMatch(/overflow:\s*hidden/);
  });

  it("keeps the blur off the phone's Panels", () => {
    expect(css).toMatch(
      /@media \(hover: hover\) and \(width >= 56\.25rem\)\s*\{\s*\.panel\s*\{[^}]*backdrop-filter/,
    );
  });
});
