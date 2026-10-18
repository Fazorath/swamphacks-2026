import { countdownTone } from "./WaveEtaCard";

test("the countdown is white from 15 minutes, amber under 15, red under 5", () => {
  expect(countdownTone(16)).toBe("far");
  expect(countdownTone(15)).toBe("far");
  expect(countdownTone(14)).toBe("soon");
  expect(countdownTone(5)).toBe("soon");
  expect(countdownTone(4)).toBe("now");
  expect(countdownTone(0)).toBe("now");
});
