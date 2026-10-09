import {
  VEHICLE_LENGTH,
  VEHICLE_WIDTH,
  type Point,
  type StopEpisode,
  type StopLine,
  type StopViolation,
  type Vehicle,
} from '../world/model';
const STOP_APPROACH_DISTANCE = 3;
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const front = (v: Vehicle): Point => ({
  x: v.x + (Math.cos(v.heading) * VEHICLE_LENGTH) / 2,
  y: v.y + (Math.sin(v.heading) * VEHICLE_LENGTH) / 2,
});
export function stopDistance(v: Vehicle, line: StopLine) {
  const p = front(v);
  return dot({ x: line.a.x - p.x, y: line.a.y - p.y }, line.direction);
}
/** Technical tolerance: bumper within 3 m before the line, speed <= 0.03 m/s. No legal waiting period. */
export function checkStop(
  previous: Vehicle,
  next: Vehicle,
  line: StopLine,
  episode: StopEpisode,
  tick: number,
): { episode: StopEpisode; violation?: StopViolation; passed: boolean } {
  let state = { ...episode };
  const before = stopDistance(previous, line),
    after = stopDistance(next, line);
  const tangent = { x: line.b.x - line.a.x, y: line.b.y - line.a.y };
  const length = Math.hypot(tangent.x, tangent.y);
  const lateral = (p: Point) => dot({ x: p.x - line.a.x, y: p.y - line.a.y }, tangent) / length;
  const within = (p: Point) =>
    lateral(p) >= -VEHICLE_WIDTH / 2 && lateral(p) <= length + VEHICLE_WIDTH / 2;
  const facing =
    dot({ x: Math.cos(next.heading), y: Math.sin(next.heading) }, line.direction) > 0.5;
  if (after > 18 || after < -18 || !within(front(next))) {
    if (state.phase === 'crossed' || state.stopped) {
      state = { phase: 'ready', stopped: false, number: state.number + 1 };
    }
  }
  if (state.phase === 'crossed') {
    return { episode: state, passed: false };
  }
  if (
    facing &&
    within(front(next)) &&
    after >= 0 &&
    after <= STOP_APPROACH_DISTANCE &&
    Math.abs(next.speed) <= 0.03
  ) {
    state.stopped = true;
  }
  if (after > 4) {
    state.stopped = false;
  } // backing away invalidates an earlier stop for this approach
  if (before >= 0 && after < 0 && facing && next.speed > 0) {
    const ratio = before / (before - after);
    const p = front(previous),
      q = front(next);
    if (within({ x: p.x + (q.x - p.x) * ratio, y: p.y + (q.y - p.y) * ratio })) {
      state.phase = 'crossed';
      return {
        episode: state,
        passed: state.stopped,
        violation: state.stopped
          ? undefined
          : { type: 'stop', roadObjectId: line.id, episode: state.number, speed: next.speed, tick },
      };
    }
  }
  return { episode: state, passed: false };
}
