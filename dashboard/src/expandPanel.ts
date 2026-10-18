import { fireEvent, screen } from "@testing-library/react";

// A calm day opens only the Readings Panel (D-50); a test about another Panel opens it first.
export function expandPanel(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Expand ${name}` }));
}
