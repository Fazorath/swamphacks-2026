import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

import { forgetMaps } from "./fakeMaplibre";

vi.mock("maplibre-gl", () => import("./fakeMaplibre"));

afterEach(forgetMaps);
