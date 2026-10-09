import type { Crossing, PedestrianState } from './model';

// Допуск игровой геометрии вокруг машины, в метрах.
export const PEDESTRIAN_CLEARANCE_METERS = 0.35;

export function pedestrianPosition(crossing: Crossing, pedestrian: PedestrianState) {
  return {
    x: crossing.from.x + (crossing.to.x - crossing.from.x) * pedestrian.progress,
    y: crossing.from.y + (crossing.to.y - crossing.from.y) * pedestrian.progress,
  };
}
