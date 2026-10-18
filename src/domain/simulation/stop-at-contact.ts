import type { RoadMap, World } from '../world/model';
import { pathLength, positionAlongPath } from '../world/path-geometry';
import { interpolateVehicle } from '../world/swept-vehicles';
import { routePath } from './traffic-route';

/** Keep the travelled part of the step; transitions and spawning wait until driving resumes. */
export function stopAtContact(previous: World, next: World, map: RoadMap, contactFraction: number) {
  const fraction = Math.max(0, contactFraction - 1e-5);

  Object.assign(next.vehicle, interpolateVehicle(previous.vehicle, next.vehicle, fraction));

  const plannedTraffic = next.traffic;

  next.traffic = structuredClone(previous.traffic);

  if (!map.network) {
    return;
  }

  for (const car of next.traffic.vehicles) {
    const planned = plannedTraffic.vehicles.find((item) => item.id === car.id);

    if (!planned) {
      continue;
    }

    const path = routePath(car, map.network);

    const sameSegment = car.segment === planned.segment && car.laneId === planned.laneId;

    const endDistance = sameSegment ? planned.distance : pathLength(path);

    car.distance += (endDistance - car.distance) * fraction;
    Object.assign(car.vehicle, positionAlongPath(path, car.distance));
    car.vehicle.speed = planned.vehicle.speed;
    car.reaction = planned.reaction;
  }
}
