import { cause } from '../violations/causes';
import {
  VEHICLE_LENGTH,
  VEHICLE_WIDTH,
  type Crossing,
  type DetectedViolation,
  type PedestrianState,
  type RoadMap,
  type Vehicle,
  type World,
} from '../world/model';
import { PEDESTRIAN_CLEARANCE_METERS, pedestrianPosition } from '../world/pedestrian';

const CONFLICT_SEARCH_RADIUS_METERS = 20;

const REACTION_HORIZON_SECONDS = 1.2;

const PREDICTION_STEP_SECONDS = 0.1;

/** Пешеход тормозит только при прогнозе пересечения с машиной, а не из-за близости. */
export function predictsPedestrianConflict(
  crossing: Crossing,
  pedestrian: PedestrianState,
  vehicle: Vehicle,
): boolean {
  const position = pedestrianPosition(crossing, pedestrian);

  if (Math.hypot(position.x - vehicle.x, position.y - vehicle.y) >= CONFLICT_SEARCH_RADIUS_METERS) {
    return false;
  }

  const pathLength = Math.hypot(crossing.to.x - crossing.from.x, crossing.to.y - crossing.from.y);

  const forwardX = Math.cos(vehicle.heading);

  const forwardY = Math.sin(vehicle.heading);

  for (let seconds = 0; seconds <= REACTION_HORIZON_SECONDS; seconds += PREDICTION_STEP_SECONDS) {
    const progress = pedestrian.progress + (crossing.speed * seconds) / pathLength;

    if (progress > 1) {
      break;
    }

    const pedestrianX = crossing.from.x + (crossing.to.x - crossing.from.x) * progress;

    const pedestrianY = crossing.from.y + (crossing.to.y - crossing.from.y) * progress;

    const relativeX = pedestrianX - vehicle.x - forwardX * vehicle.speed * seconds;

    const relativeY = pedestrianY - vehicle.y - forwardY * vehicle.speed * seconds;

    const longitudinalGap = Math.abs(relativeX * forwardX + relativeY * forwardY);

    const lateralGap = Math.abs(-relativeX * forwardY + relativeY * forwardX);

    if (
      longitudinalGap < VEHICLE_LENGTH / 2 + PEDESTRIAN_CLEARANCE_METERS &&
      lateralGap < VEHICLE_WIDTH / 2 + PEDESTRIAN_CLEARANCE_METERS
    ) {
      return true;
    }
  }

  return false;
}

/** Читает результат движения и сообщает только о первой помехе в эпизоде. */
export function checkPedestrians(previous: World, next: World, map: RoadMap): DetectedViolation[] {
  const violations: DetectedViolation[] = [];

  for (const crossing of map.crossings ?? []) {
    const pedestrian = next.pedestrians[crossing.id];

    if (pedestrian.reaction !== 'vehicle' || previous.pedestrians[crossing.id].obstructed) {
      continue;
    }

    violations.push({
      type: 'pedestrian',
      roadObjectId: crossing.id,
      episode: pedestrian.episode,
      speed: next.vehicle.speed,
      tick: next.tick,
      causes: [
        cause('pedestrian-obstruction', {
          priority: true,
          intendedSpeed: crossing.speed,
          actualSpeed: 0,
          reaction: 'braking-for-vehicle',
          progress: pedestrian.progress,
        }),
      ],
    });
  }

  return violations;
}
