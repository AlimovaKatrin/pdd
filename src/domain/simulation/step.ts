import { checkStop } from '../rules/stop';
import { type Controls, type RoadMap, type StopViolation, type World } from '../world/model';
export const STEP = 1 / 60;
export function stepWorld(
  world: World,
  controls: Controls,
  map: RoadMap,
): { world: World; violations: StopViolation[] } {
  const v = { ...world.vehicle };
  if (controls.brake || (controls.throttle && controls.reverse)) {
    v.speed = Math.sign(v.speed) * Math.max(0, Math.abs(v.speed) - 12 * STEP);
  } else if (controls.throttle) {
    v.speed += (v.speed < 0 ? 10 : 4) * STEP;
  } else if (controls.reverse) {
    v.speed -= (v.speed > 0 ? 10 : 3) * STEP;
  } else {
    v.speed = Math.sign(v.speed) * Math.max(0, Math.abs(v.speed) - 1.4 * STEP);
  }
  v.speed = Math.max(-3, Math.min(12, v.speed));
  const rotation = ((controls.steer * v.speed) / 5.5) * STEP;
  v.heading += rotation;
  if (v.indicator) {
    v.indicatorTurn += rotation;
    if (Math.abs(v.indicatorTurn) > 0.65 && controls.steer === 0) {
      v.indicator = null;
      v.indicatorTurn = 0;
    }
  }
  const x = v.x + Math.cos(v.heading) * v.speed * STEP;
  const y = v.y + Math.sin(v.heading) * v.speed * STEP;
  // Prototype road corridor: prevents driving through decorative buildings.
  const onRoad = map.roads.some(
    (r) => x > r.x + 1 && x < r.x + r.width - 1 && y > r.y + 1 && y < r.y + r.height - 1,
  );
  if (onRoad) {
    v.x = x;
    v.y = y;
  } else {
    v.speed = 0;
  }
  const next: World = { ...world, tick: world.tick + 1, vehicle: v, stops: { ...world.stops } };
  const violations: StopViolation[] = [];
  for (const line of map.stops) {
    const result = checkStop(world.vehicle, v, line, world.stops[line.id], next.tick);
    next.stops[line.id] = result.episode;
    if (result.violation) {
      violations.push(result.violation);
    }
    if (result.passed) {
      next.successfulStops += 1;
    }
  }
  return { world: next, violations };
}
