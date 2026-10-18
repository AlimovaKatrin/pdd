import { predictsPlayerConflict } from './traffic-conflict';
import { speedForTrafficPath } from './traffic-speed';
import type { RoadMap, World, Vehicle } from '../world/model';
import type { TrafficVehicle, TrafficReaction } from '../world/vehicles';
import { VEHICLE_LENGTH, VEHICLE_WIDTH } from '../world/vehicles';
import { signalColor } from '../world/traffic';
import {
  pathLength,
  pointDistance,
  positionAlongPath,
  projectOnSegment,
} from '../world/path-geometry';
import { priorityObstacle } from './traffic-priority';
import { routePath } from './traffic-route';

const CRUISE_SPEED = 8;

const BRAKING = 6;

const ACCELERATION = 2;

function pathObstacleDistance(
  car: TrafficVehicle,
  path: readonly { x: number; y: number }[],
  other: Vehicle,
): number | null {
  let travelled = 0;

  let nearest: number | null = null;

  for (let index = 1; index < path.length; index++) {
    const projection = projectOnSegment(other, path[index - 1], path[index]);

    const distance = travelled + projection.along - car.distance;

    if (
      projection.along >= 0 &&
      projection.along <= projection.length &&
      Math.abs(projection.lateral) < VEHICLE_WIDTH + 0.6 &&
      distance > 0 &&
      (nearest === null || distance < nearest)
    ) {
      nearest = distance;
    }

    travelled += projection.length;
  }

  return nearest;
}

export function stepTrafficCar(
  previous: TrafficVehicle,
  world: World,
  map: RoadMap,
  stepSeconds: number,
): TrafficVehicle {
  const network = map.network!;

  const car = structuredClone(previous);

  const lane = network.lanes.find((item) => item.id === car.laneId)!;

  const path = routePath(car, network);

  const length = pathLength(path);

  const connection = network.connections.find((item) => item.id === car.connectionId);

  const junction = network.junctions.find((item) => item.id === lane.endJunction);

  const approach = junction?.approaches.find((item) => item.incomingLaneId === lane.id);

  const futurePath = [...path];

  if (connection) {
    if (car.segment === 'lane') {
      futurePath.push(...connection.path.slice(1));
    }

    const outgoing = network.lanes.find((item) => item.id === connection.toLaneId)!;

    futurePath.push(outgoing.to);
  }

  let targetSpeed = speedForTrafficPath(
    map,
    car.vehicle,
    futurePath,
    car.distance,
    CRUISE_SPEED,
    BRAKING,
    stepSeconds,
  );

  let maximumDistance = Infinity;

  car.reaction = null;

  function stopBefore(distance: number, reaction: TrafficReaction) {
    const remaining = distance < 1e-6 ? 0 : distance;

    const allowed = Math.sqrt(2 * BRAKING * remaining);

    if (allowed <= targetSpeed || remaining < maximumDistance) {
      targetSpeed = Math.min(targetSpeed, allowed);
      maximumDistance = Math.min(maximumDistance, remaining);
      car.reaction = reaction;
    }
  }

  if (car.segment === 'lane') {
    const stopDistance = length - car.distance - VEHICLE_LENGTH / 2 - 1;

    if (approach?.stopId && !car.stopped) {
      stopBefore(stopDistance, { reason: 'stop' });

      if (stopDistance <= 0.05 && previous.vehicle.speed <= 0.03) {
        car.stopped = true;
      }
    }

    const signal = map.signals?.find((item) => item.id === approach?.signalId);

    if (signal && signalColor(signal, world.tick) !== 'green' && stopDistance >= -0.05) {
      stopBefore(stopDistance, { reason: 'signal' });
    }

    if (junction && stopDistance < 30) {
      const obstacle = priorityObstacle(car, world, map);

      if (obstacle) {
        stopBefore(stopDistance, obstacle);
      }
    }

    if (!lane.endJunction && pointDistance(car.vehicle, world.vehicle) < 80) {
      stopBefore(length - car.distance - VEHICLE_LENGTH / 2, { reason: 'boundary' });
    }
  }

  if (connection && (car.segment === 'junction' || length - car.distance < 20)) {
    if (connection.movement !== 'straight') {
      targetSpeed = Math.min(targetSpeed, 4);
    }

    car.vehicle.indicator = connection.movement === 'straight' ? null : connection.movement;
  } else {
    car.vehicle.indicator = null;
  }

  if (car.segment === 'junction' && junction?.control !== 'equal') {
    const obstacle = priorityObstacle(car, world, map);

    if (obstacle) {
      targetSpeed = 0;
      car.reaction = obstacle;
    }
  }

  if (
    targetSpeed > 0 &&
    predictsPlayerConflict(car.vehicle, futurePath, car.distance, world.vehicle)
  ) {
    targetSpeed = 0;
    car.reaction = { reason: 'vehicle', participantId: 'player', junctionId: junction?.id };
  }

  const participants = [
    { id: 'player', vehicle: world.vehicle },
    ...world.traffic.vehicles.filter((other) => other.id !== car.id),
  ];

  for (const other of participants) {
    const distance = pathObstacleDistance(car, futurePath, other.vehicle);

    if (distance !== null && distance < 30) {
      stopBefore(distance - VEHICLE_LENGTH - 3, {
        reason: 'vehicle',
        participantId: other.id,
        junctionId: junction?.id,
      });
    }
  }

  for (const crossing of map.crossings ?? []) {
    const pedestrian = world.pedestrians[crossing.id];

    if (!pedestrian || pedestrian.waiting > 0) {
      continue;
    }

    // Reserve the whole crossing while the pedestrian walks across either lane.
    // This is conservative driving, not a legal violation inferred from proximity.
    let travelled = 0;

    for (let index = 1; index < futurePath.length; index++) {
      const start = projectOnSegment(crossing.from, futurePath[index - 1], futurePath[index]);

      const end = projectOnSegment(crossing.to, futurePath[index - 1], futurePath[index]);

      if (start.lateral * end.lateral <= 0 && start.lateral !== end.lateral) {
        const fraction = start.lateral / (start.lateral - end.lateral);

        const along = start.along + (end.along - start.along) * fraction;

        const distance = travelled + along - car.distance;

        if (along >= 0 && along <= start.length && distance > 0 && distance < 30) {
          stopBefore(distance - VEHICLE_LENGTH / 2 - 3, {
            reason: 'pedestrian',
            participantId: crossing.id,
          });
        }
      }

      travelled += start.length;
    }
  }

  car.vehicle.speed =
    targetSpeed < previous.vehicle.speed
      ? Math.max(targetSpeed, previous.vehicle.speed - BRAKING * stepSeconds)
      : Math.min(targetSpeed, previous.vehicle.speed + ACCELERATION * stepSeconds);

  const movement = Math.min(car.vehicle.speed * stepSeconds, maximumDistance);

  if (movement < car.vehicle.speed * stepSeconds) {
    car.vehicle.speed = movement / stepSeconds;
  }

  car.distance += movement;
  car.waitingTicks = car.vehicle.speed < 0.03 ? car.waitingTicks + 1 : 0;
  Object.assign(car.vehicle, positionAlongPath(path, car.distance));

  return car;
}
