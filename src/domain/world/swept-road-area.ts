import type { Point, Vehicle } from './model';
import { VEHICLE_LENGTH, VEHICLE_WIDTH } from './model';
import { angleDifference } from './traffic';
import { interpolateVehicle } from './swept-vehicles';

/** Continuous translation against a rectangular road area, split into small rotation arcs. */
export function crossesRoadArea(
  previous: Vehicle,
  next: Vehicle,
  from: Point,
  to: Point,
  width: number,
): boolean {
  const reach = Math.hypot(VEHICLE_LENGTH, VEHICLE_WIDTH) / 2 + width / 2;

  if (
    Math.max(previous.x, next.x) + reach < Math.min(from.x, to.x) ||
    Math.min(previous.x, next.x) - reach > Math.max(from.x, to.x) ||
    Math.max(previous.y, next.y) + reach < Math.min(from.y, to.y) ||
    Math.min(previous.y, next.y) - reach > Math.max(from.y, to.y)
  ) {
    return false;
  }

  const length = Math.hypot(to.x - from.x, to.y - from.y);

  const roadHeading = Math.atan2(to.y - from.y, to.x - from.x);

  const rotation = Math.abs(angleDifference(next.heading, previous.heading));

  const parts = Math.max(1, Math.ceil(rotation / 0.002));

  // One centimetre is a geometric tolerance, not permission to cross a marking.
  const tolerance = 0.01;

  for (let part = 0; part < parts; part++) {
    const start = interpolateVehicle(previous, next, part / parts);

    const end = interpolateVehicle(previous, next, (part + 1) / parts);

    const heading = (start.heading + end.heading) / 2;

    let enter = 0;

    let exit = 1;

    for (const axis of [roadHeading, roadHeading + Math.PI / 2, heading, heading + Math.PI / 2]) {
      const radius =
        (Math.abs(Math.cos(roadHeading - axis)) * length) / 2 +
        (Math.abs(Math.sin(roadHeading - axis)) * width) / 2 +
        (Math.abs(Math.cos(heading - axis)) * VEHICLE_LENGTH) / 2 +
        (Math.abs(Math.sin(heading - axis)) * VEHICLE_WIDTH) / 2 -
        tolerance;

      const offset =
        (start.x - (from.x + to.x) / 2) * Math.cos(axis) +
        (start.y - (from.y + to.y) / 2) * Math.sin(axis);

      const movement = (end.x - start.x) * Math.cos(axis) + (end.y - start.y) * Math.sin(axis);

      if (Math.abs(movement) < 1e-12) {
        if (Math.abs(offset) >= radius) {
          exit = -1;
          break;
        }

        continue;
      }

      const first = (-radius - offset) / movement;

      const last = (radius - offset) / movement;

      enter = Math.max(enter, Math.min(first, last));
      exit = Math.min(exit, Math.max(first, last));

      if (enter >= exit) {
        break;
      }
    }

    if (enter < exit) {
      return true;
    }
  }

  return false;
}
