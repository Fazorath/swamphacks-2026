import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Read from disk: Vitest turns every imported stylesheet, even `?raw`, into an empty string.
const dashboardDir = join(import.meta.dirname, "..");
const srcDir = join(dashboardDir, "src");

const themeCss = readFileSync(join(srcDir, "theme.css"), "utf8");

const stylesAndComponents = [
  ...readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(css|tsx?)$/.test(name))
    .filter((name) => name !== "theme.css" && !/\.test\.tsx?$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(srcDir, name), "utf8") })),
  { name: "index.html", text: readFileSync(join(dashboardDir, "index.html"), "utf8") },
];

const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|lab)\(/;
// A primitive is any custom property the theme file sets straight to a hex value.
const primitiveNames = [...themeCss.matchAll(/(--[\w-]+):\s*#[0-9a-fA-F]{6};/g)].map(
  ([, name]) => name,
);
const PRIMITIVE = new RegExp(`var\\((?:${primitiveNames.join("|")})\\)`);

function filesMatching(pattern: RegExp): string[] {
  return stylesAndComponents.filter(({ text }) => pattern.test(text)).map(({ name }) => name);
}

describe("the theme file owns every colour", () => {
  it("is the only file with a raw colour value", () => {
    expect(filesMatching(RAW_COLOUR)).toEqual([]);
  });

  it("is the only file that names a palette primitive", () => {
    expect(filesMatching(PRIMITIVE)).toEqual([]);
  });

  it("looks at the stylesheet and the components, not at nothing", () => {
    const names = stylesAndComponents.map(({ name }) => name);
    expect(names).toContain("App.css");
    expect(names).toContain("App.tsx");
    expect(RAW_COLOUR.test(themeCss)).toBe(true);
    expect(primitiveNames).toContain("--navy-950");
  });
});

describe("fonts and icons are bundled", () => {
  it("never asks Google Fonts or another host for a font", () => {
    expect(filesMatching(/fonts\.googleapis|fonts\.gstatic|@import\s+url\(/)).toEqual([]);
  });

  it("names a font only through the theme's two font roles", () => {
    expect(filesMatching(/font-family:\s*(?!var\(--font-(?:sans|mono)\))\S/)).toEqual([]);
  });
});

function declaredValues(): Map<string, string> {
  const values = new Map<string, string>();
  for (const [, name, value] of themeCss.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    values.set(name, value.trim());
  }
  return values;
}

function colourOf(role: string): [number, number, number] {
  const values = declaredValues();
  let value = values.get(role);
  while (value?.startsWith("var(")) value = values.get(value.slice(4, -1));
  if (!value || !/^#[0-9a-f]{6}$/.test(value)) throw new Error(`${role} is not a plain colour`);
  const hex = value.slice(1);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(text: string, background: string): number {
  const [light, dark] = [luminance(colourOf(text)), luminance(colourOf(background))].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}

describe("text contrast", () => {
  const pageSurfaces = ["--bg-page", "--surface-panel", "--surface-raised"];
  const readableOnDark = [
    "--text-primary",
    "--text-secondary",
    "--accent",
    "--risk-low",
    "--risk-elevated",
    "--risk-high",
    "--danger",
    "--community-warning",
  ];

  it.each(readableOnDark.flatMap((text) => pageSurfaces.map((surface) => [text, surface])))(
    "%s on %s is at least 7:1",
    (text, surface) => {
      expect(contrast(text, surface)).toBeGreaterThanOrEqual(7);
    },
  );

  it.each([
    ["--official-ink", "--official-bg"],
    ["--official-tag-ink", "--official-tag"],
    ["--accent-ink", "--accent"],
  ])("%s on %s is at least 7:1", (text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(7);
  });

  it.each(["--bg-page", "--surface-panel"])(
    "--text-dim, used for Unverified Nodes, is at least 4.5:1 on %s",
    (surface) => {
      expect(contrast("--text-dim", surface)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
