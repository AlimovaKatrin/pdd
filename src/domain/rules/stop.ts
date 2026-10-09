import { crossingFraction, distance as stopDistance, within } from './geometry';
import { type StopEpisode, type StopLine, type StopViolation, type Vehicle } from '../world/model';

const STOP_APPROACH_DISTANCE = 3;

export { distance as stopDistance } from './geometry';

/** Technical tolerance: bumper within 3 m before the line, speed <= 0.03 m/s. No legal waiting period. */
export function checkStop(
  previous: Vehicle,
  next: Vehicle,
  line: StopLine,
  episode: StopEpisode,
  tick: number,
): { episode: StopEpisode; violation?: StopViolation; passed: boolean } {
  let state = { ...episode };

  const after = stopDistance(next, line);

  const facing =
    Math.cos(next.heading) * line.direction.x + Math.sin(next.heading) * line.direction.y > 0.5;

  if (after > 18 || after < -18 || !within(next, line)) {
    if (state.phase === 'crossed' || state.stopped) {
      state = { phase: 'ready', stopped: false, number: state.number + 1 };
    }
  }

  if (state.phase === 'crossed') {
    return { episode: state, passed: false };
  }

  if (
    facing &&
    within(next, line) &&
    after >= 0 &&
    after <= STOP_APPROACH_DISTANCE &&
    Math.abs(next.speed) <= 0.03
  ) {
    state.stopped = true;
  }

  if (after > 4) {
    state.stopped = false;
  } // backing away invalidates an earlier stop for this approach

  if (crossingFraction(previous, next, line) !== null) {
    state.phase = 'crossed';

    return {
      episode: state,
      passed: state.stopped,
      violation: state.stopped
        ? undefined
        : { type: 'stop', roadObjectId: line.id, episode: state.number, speed: next.speed, tick },
    };
  }

  return { episode: state, passed: false };
}
