import { stepTraffic } from './traffic';
import { checkTurn } from '../maneuvers/turn';
import { updateDrivingProgress } from './driving-progress';
import { checkSpeed } from '../rules/speed';
import { checkSignals } from '../rules/signals';
import { stepPedestrians } from './pedestrians';
import { cause } from '../violations/causes';
import { checkStop } from '../rules/stop';
import { type Controls, type RoadMap, type DetectedViolation, type World } from '../world/model';

export const STEP = 1 / 60;

// Technical ceiling of 72 km/h makes the city limit reachable during ordinary play.
const MAX_FORWARD_SPEED_METERS_PER_SECOND = 20;

const MAX_REVERSE_SPEED_METERS_PER_SECOND = 3;

export function stepWorld(
  world: World,
  controls: Controls,
  map: RoadMap,
): { world: World; violations: DetectedViolation[] } {
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

  v.speed = Math.max(
    -MAX_REVERSE_SPEED_METERS_PER_SECOND,
    Math.min(MAX_FORWARD_SPEED_METERS_PER_SECOND, v.speed),
  );

  const rotation = ((controls.steer * v.speed) / 5.5) * STEP;

  v.heading += rotation;

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

  const next: World = {
    ...world,
    tick: world.tick + 1,
    vehicle: v,
    stops: { ...world.stops },
    speedEpisodes: structuredClone(world.speedEpisodes),
    signalEpisodes: structuredClone(world.signalEpisodes),
    pedestrians: { ...world.pedestrians },
    advisories: world.tick < world.advisoryUntil ? world.advisories : [],
  };

  const violations: DetectedViolation[] = [];

  for (const line of map.stops) {
    const result = checkStop(world.vehicle, v, line, world.stops[line.id], next.tick);

    next.stops[line.id] = result.episode;

    if (result.violation) {
      violations.push({
        ...result.violation,
        causes: [cause('stop-line', { speedKmh: v.speed * 3.6, stopped: false })],
      });
    }

    if (result.passed) {
      next.successfulManeuvers += 1;
    }
  }

  violations.push(
    ...checkSpeed(next, map),
    ...checkSignals(world, next, map),
    ...checkTurn(world, next, map),
    ...stepPedestrians(world, next, map, STEP),
  );
  stepTraffic(world, next, map, STEP);
  updateDrivingProgress(world, next, map, violations);

  return { world: next, violations };
}
