import { VEHICLE_LENGTH, VEHICLE_WIDTH, type Vehicle } from './model';
import type { ReadonlyData } from './read-only';
import type { Lane, LaneConnection, RoadNetwork } from './road-network';
import { distanceToSegment, projectOnSegment } from './path-geometry';
import type { Point } from './point';

export function vehicleCorners(vehicle: Vehicle): Point[] {
  const forward = { x: Math.cos(vehicle.heading), y: Math.sin(vehicle.heading) };

  return [-1, 1].flatMap((longitudinal) =>
    [-1, 1].map((lateral) => ({
      x:
        vehicle.x +
        (longitudinal * forward.x * VEHICLE_LENGTH) / 2 -
        (lateral * forward.y * VEHICLE_WIDTH) / 2,
      y:
        vehicle.y +
        (longitudinal * forward.y * VEHICLE_LENGTH) / 2 +
        (lateral * forward.x * VEHICLE_WIDTH) / 2,
    })),
  );
}

export function laneOccupation(lane: ReadonlyData<Lane>, vehicle: Vehicle) {
  const projections = vehicleCorners(vehicle).map((corner) =>
    projectOnSegment(corner, lane.from, lane.to),
  );

  const centre = projectOnSegment(vehicle, lane.from, lane.to);

  const from = Math.min(...projections.map((p) => p.along));

  const to = Math.max(...projections.map((p) => p.along));

  const left = Math.min(...projections.map((p) => p.lateral));

  const right = Math.max(...projections.map((p) => p.lateral));

  return {
    overlaps:
      to >= 0 && from <= centre.length && right >= -lane.width / 2 && left <= lane.width / 2,
    contained:
      from >= 0 && to <= centre.length && left >= -lane.width / 2 && right <= lane.width / 2,
    centre,
  };
}

export function laneAt(network: ReadonlyData<RoadNetwork>, vehicle: Vehicle) {
  return network.lanes
    .map((lane) => ({ lane, occupation: laneOccupation(lane, vehicle) }))
    .filter(
      ({ occupation }) =>
        occupation.overlaps &&
        occupation.centre.along >= 0 &&
        occupation.centre.along <= occupation.centre.length,
    )
    .sort(
      (a, b) => Math.abs(a.occupation.centre.lateral) - Math.abs(b.occupation.centre.lateral),
    )[0]?.lane;
}

/** Intermediate poses avoid missing thin lane boundaries on long or turning steps. */
export function sweptLaneIds(
  network: ReadonlyData<RoadNetwork>,
  previous: Vehicle,
  next: Vehicle,
): string[] {
  const distance = Math.hypot(next.x - previous.x, next.y - previous.y);

  const rotation = Math.atan2(
    Math.sin(next.heading - previous.heading),
    Math.cos(next.heading - previous.heading),
  );

  const count = Math.max(
    1,
    Math.ceil((distance + (Math.abs(rotation) * VEHICLE_LENGTH) / 2) / (VEHICLE_WIDTH / 4)),
  );

  const touched = new Set<string>();

  for (let index = 0; index <= count; index++) {
    const fraction = index / count;

    const pose = {
      ...next,
      x: previous.x + (next.x - previous.x) * fraction,
      y: previous.y + (next.y - previous.y) * fraction,
      heading: previous.heading + rotation * fraction,
    };

    for (const lane of network.lanes) {
      if (laneOccupation(lane, pose).overlaps) {
        touched.add(lane.id);
      }
    }
  }

  return [...touched];
}

export function connectionForVehicle(
  network: ReadonlyData<RoadNetwork>,
  incomingLaneId: string,
  vehicle: Vehicle,
): ReadonlyData<LaneConnection> | null {
  const candidates = network.connections.filter(
    (connection) => connection.fromLaneId === incomingLaneId,
  );

  let best: ReadonlyData<LaneConnection> | null = null;

  let bestDistance = VEHICLE_WIDTH;

  for (const candidate of candidates) {
    for (let index = 1; index < candidate.path.length; index++) {
      const from = candidate.path[index - 1];

      const to = candidate.path[index];

      const heading = Math.atan2(to.y - from.y, to.x - from.x);

      if (Math.cos(heading - vehicle.heading) < 0.9) {
        continue;
      }

      const distance = distanceToSegment(vehicle, from, to);

      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }

  return best;
}
