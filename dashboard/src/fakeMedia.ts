// jsdom does not play media: its play and pause only report "not implemented" and currentTime
// does not move. This gives every <video> a clock that tests can read back.
const times = new WeakMap<HTMLMediaElement, number>();
const paused = new WeakMap<HTMLMediaElement, boolean>();

export function installFakeMedia(): void {
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return times.get(this) ?? 0;
    },
    set(this: HTMLMediaElement, seconds: number) {
      times.set(this, seconds);
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return paused.get(this) ?? true;
    },
  });
  HTMLMediaElement.prototype.play = async function play(this: HTMLMediaElement) {
    paused.set(this, false);
  };
  HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement) {
    paused.set(this, true);
  };
}
