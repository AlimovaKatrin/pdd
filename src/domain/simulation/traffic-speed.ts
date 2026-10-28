import type { Point, RoadMap, Vehicle } from '../world/model';
import { positionAlongPath } from '../world/path-geometry';
import { activeSpeedLimit } from '../world/traffic';

const LOOKAHEAD_STEP_METERS = 0.25;

/** Brake before a lower limit reaches the front bumper, including a limit after a turn. */
export function speedForTrafficPath(
  map: RoadMap,
  vehicle: Vehicle,
  path: readonly Point[],
  distance: number,
  cruiseSpeed: number,
  braking: number,
  stepSeconds: number,
): number {
  let speed = Math.min(cruiseSpeed, activeSpeedLimit(map, vehicle).limit / 3.6);

  if (
    map.citySpeedLimit.limit >= cruiseSpeed * 3.6 &&
    (map.speedZones ?? []).every((zone) => zone.limit >= cruiseSpeed * 3.6)
  ) {
    return speed;
  }

  const lookahead = vehicle.speed ** 2 / (2 * braking) + 2;

  for (let ahead = LOOKAHEAD_STEP_METERS; ahead <= lookahead; ahead += LOOKAHEAD_STEP_METERS) {
    const pose = { ...vehicle, ...positionAlongPath(path, distance + ahead) };

    const limit = activeSpeedLimit(map, pose).limit / 3.6;

    // The interval and one simulation step are reserved before the sampled boundary.
    const remaining = Math.max(0, ahead - LOOKAHEAD_STEP_METERS - vehicle.speed * stepSeconds);

    speed = Math.min(speed, Math.sqrt(limit ** 2 + 2 * braking * remaining));
  }

  return speed;
}
