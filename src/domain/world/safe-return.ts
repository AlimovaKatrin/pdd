import { initialWorld, type RoadMap, type World } from './model';
import { distanceToSegment, pointDistance } from './path-geometry';
import type { Vehicle } from './vehicles';

/** Reserve reaction space around the stopped player; other participants keep their state. */
export function safeReturnVehicle(map: RoadMap, world: World): Vehicle | null {
  const positions = map.network?.safePositions ?? [map.spawn];

  const candidates = [...positions].sort(
    (a, b) => pointDistance(a, world.vehicle) - pointDistance(b, world.vehicle),
  );

  for (const position of candidates) {
    const occupied = world.traffic.vehicles.some(
      (car) =>
        pointDistance(position, car.vehicle) < Math.max(12, Math.abs(car.vehicle.speed) * 3 + 6),
    );

    const onCrossing = map.crossings?.some(
      (crossing) => distanceToSegment(position, crossing.from, crossing.to) < 8,
    );

    if (occupied || onCrossing) {
      continue;
    }

    return {
      x: position.x,
      y: position.y,
      heading: position.heading,
      speed: 0,
      indicator: null,
      indicatorTurn: 0,
    };
  }

  return null;
}

export function worldAfterSafeReturn(map: RoadMap, world: World): World | null {
  const vehicle = safeReturnVehicle(map, world);

  if (!vehicle) {
    return null;
  }

  const fresh = initialWorld(map);

  return {
    ...world,
    relocation: world.relocation + 1,
    vehicle,
    stops: fresh.stops,
    signalEpisodes: fresh.signalEpisodes,
    speedEpisodes: fresh.speedEpisodes,
    drivingProgress: fresh.drivingProgress,
    maneuver: null,
    advisories: [],
    advisoryUntil: 0,
  };
}
