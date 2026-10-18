// Browsers refuse sound until the page has been tapped once, so a chime before that is skipped
// rather than queued.
let tapped = false;
if (typeof window !== "undefined") {
  const noteTap = () => {
    tapped = true;
  };
  window.addEventListener("pointerdown", noteTap, { capture: true });
  window.addEventListener("keydown", noteTap, { capture: true });
}

const NOTES_HZ = [660, 880];
const NOTE_SECONDS = 0.18;

// Two short notes, once. Never repeats.
export function playChime(): void {
  const Context = window.AudioContext;
  if (!tapped || typeof Context !== "function") return;
  const context = new Context();
  NOTES_HZ.forEach((frequency, index) => {
    const start = context.currentTime + index * NOTE_SECONDS;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + NOTE_SECONDS);
    oscillator.connect(volume).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + NOTE_SECONDS);
  });
  window.setTimeout(() => void context.close(), (NOTES_HZ.length * NOTE_SECONDS + 0.2) * 1000);
}
