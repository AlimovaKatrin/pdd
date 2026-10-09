import { checkPedestrians, predictsPedestrianConflict } from '../rules/pedestrians';
import type { Crossing, PedestrianState, RoadMap, Vehicle, World } from '../world/model';

function advancePedestrian(
  previous: PedestrianState,
  crossing: Crossing,
  vehicle: Vehicle,
  stepSeconds: number,
): PedestrianState {
  const pedestrian: PedestrianState = { ...previous, reaction: null };

  if (pedestrian.waiting > 0) {
    pedestrian.waiting--;

    if (pedestrian.waiting === 0) {
      pedestrian.progress = 0;
      pedestrian.episode++;
      pedestrian.obstructed = false;
    }

    return pedestrian;
  }

  if (predictsPedestrianConflict(crossing, pedestrian, vehicle)) {
    pedestrian.reaction = 'vehicle';
    pedestrian.obstructed = true;

    return pedestrian;
  }

  const pathLength = Math.hypot(crossing.to.x - crossing.from.x, crossing.to.y - crossing.from.y);

  pedestrian.progress = Math.min(
    1,
    pedestrian.progress + (crossing.speed * stepSeconds) / pathLength,
  );

  if (pedestrian.progress === 1) {
    pedestrian.waiting = crossing.restartTicks;
  }

  return pedestrian;
}

/** Сначала обновляет участников, затем проверяет последствия шага. */
export function stepPedestrians(previous: World, next: World, map: RoadMap, stepSeconds: number) {
  for (const crossing of map.crossings ?? []) {
    next.pedestrians[crossing.id] = advancePedestrian(
      previous.pedestrians[crossing.id],
      crossing,
      next.vehicle,
      stepSeconds,
    );
  }

  return checkPedestrians(previous, next, map);
}
