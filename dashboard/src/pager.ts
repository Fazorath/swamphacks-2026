import type { Home } from "./householdProfile";
import type { NodeOnMap } from "./nodesOnMap";
import { distanceKm } from "./waveEta";

// Wide enough to cover the whole Bhote Koshi valley from any town in it: a Node upstream of home
// reaching High is the warning, long before the water is near.
export const PAGER_RADIUS_KM = 60;

export type HighNearHome = { id: string; label: string; km: number };

// Nodes within the radius whose own warning is High, nearest first.
export function highNodesNearHome(nodes: NodeOnMap[], home: Home): HighNearHome[] {
  return nodes
    .filter((node) => node.level === "high")
    .map((node) => ({ id: node.id, label: node.label, km: distanceKm(home, node.position) }))
    .filter(({ km }) => km <= PAGER_RADIUS_KM)
    .sort((a, b) => a.km - b.km);
}

// Two harsh square-wave tones, alternating fast, in three bursts: a pager, not a chime.
const TONES_HZ = [2600, 3200];
const TONE_SECONDS = 0.09;
const BEEPS_PER_BURST = 6;
const BURSTS = 3;
const BURST_GAP_SECONDS = 0.35;
const PEAK_GAIN = 0.4;

let audio: AudioContext | null = null;

// Browsers refuse sound until the page has been touched, so the first touch makes the context.
export function armPagerSound(): () => void {
  const create = () => {
    audio ??= new AudioContext();
    void audio.resume();
  };
  window.addEventListener("pointerdown", create, { once: true });
  window.addEventListener("keydown", create, { once: true });
  return () => {
    window.removeEventListener("pointerdown", create);
    window.removeEventListener("keydown", create);
  };
}

export function playPager(): void {
  if (audio === null || audio.state !== "running") {
    console.warn("pager: no sound, the page has not been touched yet");
    return;
  }
  const context = audio;
  let start = context.currentTime + 0.02;
  for (let burst = 0; burst < BURSTS; burst++) {
    for (let beep = 0; beep < BEEPS_PER_BURST; beep++) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = TONES_HZ[beep % TONES_HZ.length];
      gain.gain.setValueAtTime(PEAK_GAIN, start);
      gain.gain.setValueAtTime(0, start + TONE_SECONDS);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + TONE_SECONDS);
      start += TONE_SECONDS;
    }
    start += BURST_GAP_SECONDS;
  }
}
