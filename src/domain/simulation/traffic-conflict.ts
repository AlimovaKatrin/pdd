import type { Point, Vehicle } from '../world/model';
import { positionAlongPath, pointDistance } from '../world/path-geometry';
import { vehicleContactFraction } from '../world/swept-vehicles';

const SEARCH_RADIUS_METERS = 30;

const PREDICTION_SECONDS = 1.5;

const PREDICTION_STEP_SECONDS = 0.1;

/** Traffic anticipates a moving player; the resulting reaction alone is not a violation. */
export function predictsPlayerConflict(
  vehicle: Vehicle,
  path: readonly Point[],
  distance: number,
  player: Vehicle,
): boolean {
  if (pointDistance(vehicle, player) > SEARCH_RADIUS_METERS) {
    return false;
  }

  let beforeCar = vehicle;

  let beforePlayer = player;

  for (
    let seconds = PREDICTION_STEP_SECONDS;
    seconds <= PREDICTION_SECONDS;
    seconds += PREDICTION_STEP_SECONDS
  ) {
    const nextCar = { ...vehicle, ...positionAlongPath(path, distance + vehicle.speed * seconds) };

    const nextPlayer = {
      ...player,
      x: player.x + Math.cos(player.heading) * player.speed * seconds,
      y: player.y + Math.sin(player.heading) * player.speed * seconds,
    };

    if (vehicleContactFraction(beforeCar, nextCar, beforePlayer, nextPlayer) !== null) {
      return true;
    }

    beforeCar = nextCar;
    beforePlayer = nextPlayer;
  }

  return false;
}
