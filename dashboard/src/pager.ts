import type { Home } from "./householdProfile";
import type { NodeOnMap } from "./nodesOnMap";
import { distanceKm } from "./waveEta";

// The Node nearest home that counts, other than the one this page talks to. When it goes quiet
// the water has probably reached it, so it is the one the pager watches.
export function closestNodeToHome(nodes: NodeOnMap[], home: Home): NodeOnMap | null {
  let closest: NodeOnMap | null = null;
  let closestKm = Infinity;
  for (const node of nodes) {
    if (node.isThisNode || !node.registered) continue;
    const km = distanceKm(home, node.position);
    if (km < closestKm) {
      closest = node;
      closestKm = km;
    }
  }
  return closest;
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
