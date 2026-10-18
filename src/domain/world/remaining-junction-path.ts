import type { Point } from './point';
import { pathLength, pointDistance, positionAlongPath, projectOnSegment } from './path-geometry';
import { VEHICLE_LENGTH } from './vehicles';

/** Keep the rear of the vehicle in the path until it clears the conflict. */
export function remainingJunctionPath(path: readonly Point[], position: Point): Point[] {
  let travelled = 0;

  let closestDistance = Infinity;

  let progress = 0;

  for (let index = 1; index < path.length; index++) {
    const projection = projectOnSegment(position, path[index - 1], path[index]);

    const along = Math.max(0, Math.min(projection.length, projection.along));

    const point = positionAlongPath([path[index - 1], path[index]], along);

    const distance = pointDistance(position, point);

    if (distance < closestDistance) {
      closestDistance = distance;
      progress = travelled + along;
    }

    travelled += projection.length;
  }

  const start = Math.max(0, progress - VEHICLE_LENGTH / 2);

  const result: Point[] = [positionAlongPath(path, start)];

  travelled = 0;

  for (let index = 1; index < path.length; index++) {
    travelled += pointDistance(path[index - 1], path[index]);

    if (travelled > start) {
      result.push(path[index]);
    }
  }

  // The exit includes the vehicle's nose as it leaves the final path point.
  const end = positionAlongPath(path, pathLength(path));

  result.push({
    x: end.x + (Math.cos(end.heading) * VEHICLE_LENGTH) / 2,
    y: end.y + (Math.sin(end.heading) * VEHICLE_LENGTH) / 2,
  });

  return result;
}
