import { describe, it, expect } from "vitest";
import {
  BURST_THRESHOLD,
  BURST_WINDOW_MS,
  burstKey,
  trackBurst,
  type BurstState,
} from "./burst";

describe("trackBurst", () => {
  // Reproduces what was witnessed with OMP against http://api.anthropic.com:
  // the wrong scheme gets a fast 400 with no retry guidance, and OMP retried
  // it immediately and repeatedly with no backoff, writing one log file per
  // retry. This is the guard that stops that turning into thousands of files.
  const KEY = burstKey("POST", "/v1/messages", 400);

  it("does not suppress ordinary, spaced-out repeats of the same call", () => {
    let state: BurstState | null = null;
    let now = 0;
    for (let i = 0; i < BURST_THRESHOLD + 5; i++) {
      const result = trackBurst(state, KEY, now);
      expect(result.suppressed).toBe(false);
      state = result.state;
      now += BURST_WINDOW_MS + 1; // always outside the window
    }
  });

  it("suppresses once the same method+path+status repeats past the threshold inside the window", () => {
    let state: BurstState | null = null;
    let lastResult;
    const now = 0;
    for (let i = 0; i < BURST_THRESHOLD; i++) {
      lastResult = trackBurst(state, KEY, now); // all in the same instant
      state = lastResult.state;
    }
    expect(lastResult?.suppressed).toBe(false); // exactly at the threshold: not yet over it

    const over = trackBurst(state, KEY, now);
    expect(over.suppressed).toBe(true);
    expect(over.justDetected).toBe(true);
  });

  it("reports justDetected only once per burst, not on every suppressed repeat", () => {
    let state: BurstState | null = null;
    const now = 0;
    for (let i = 0; i < BURST_THRESHOLD; i++) {
      state = trackBurst(state, KEY, now).state;
    }

    const first = trackBurst(state, KEY, now);
    expect(first.justDetected).toBe(true);

    const second = trackBurst(first.state, KEY, now);
    expect(second.suppressed).toBe(true);
    expect(second.justDetected).toBe(false);
  });

  it("never suppresses a different call, even mid-burst on another one", () => {
    let state: BurstState | null = null;
    const now = 0;
    for (let i = 0; i < BURST_THRESHOLD + 10; i++) {
      state = trackBurst(state, KEY, now).state;
    }

    const other = trackBurst(state, burstKey("POST", "/v1/messages", 200), now);
    expect(other.suppressed).toBe(false);
  });

  it("resets the count once the gap between repeats exceeds the window, so a burst that stops is forgotten", () => {
    let state: BurstState | null = null;
    const now = 0;
    for (let i = 0; i < BURST_THRESHOLD + 10; i++) {
      state = trackBurst(state, KEY, now).state;
    }

    const afterGap = trackBurst(state, KEY, now + BURST_WINDOW_MS + 1);
    expect(afterGap.suppressed).toBe(false);
    expect(afterGap.state.count).toBe(1);
  });
});
