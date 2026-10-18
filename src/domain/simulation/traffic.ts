import { signalColor } from '../world/traffic';
import { vehiclesOverlap } from '../world/vehicle-geometry';
import type { RoadMap, World } from '../world/model';
import { VEHICLE_LENGTH } from '../world/vehicles';
import { createTrafficVehicle, randomIndex, chooseConnectionId } from '../world/traffic-state';
import { pathLength, pointDistance, positionAlongPath } from '../world/path-geometry';
import { routePath } from './traffic-route';
import { stepTrafficCar } from './traffic-car';

export function stepTraffic(previous: World, next: World, map: RoadMap, stepSeconds: number): void {
  const network = map.network;

  if (!network) {
    return;
  }

  const state = {
    ...previous.traffic,
    vehicles: previous.traffic.vehicles.map((car) =>
      stepTrafficCar(car, previous, map, stepSeconds),
    ),
  };

  for (let pass = 0; pass < state.vehicles.length; pass++) {
    let changed = false;

    for (let index = 0; index < state.vehicles.length; index++) {
      const car = state.vehicles[index];

      const obstacle = state.vehicles.find(
        (other) => other.id !== car.id && vehiclesOverlap(car.vehicle, other.vehicle, 0.5),
      );

      const blockedByPlayer = vehiclesOverlap(car.vehicle, previous.vehicle, 0.5);

      if ((obstacle || blockedByPlayer) && car.vehicle.speed > 0) {
        const held = structuredClone(previous.traffic.vehicles[index]);

        held.vehicle.speed = 0;
        held.waitingTicks++;
        held.reaction = { reason: 'vehicle', participantId: obstacle?.id ?? 'player' };
        state.vehicles[index] = held;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  for (const car of state.vehicles) {
    const path = routePath(car, network);

    if (car.segment === 'lane' && car.connectionId) {
      const before = previous.traffic.vehicles.find((item) => item.id === car.id)!;

      const lane = network.lanes.find((item) => item.id === car.laneId)!;

      const approach = network.junctions
        .find((item) => item.id === lane.endJunction)!
        .approaches.find((item) => item.incomingLaneId === lane.id)!;

      const signal = map.signals?.find((item) => item.id === approach.signalId);

      const entryDistance = pathLength(path) - VEHICLE_LENGTH / 2;

      const stopDistance = entryDistance - 1;

      if (signal && before.distance <= stopDistance && car.distance > stopDistance) {
        const fraction = (stopDistance - before.distance) / (car.distance - before.distance);

        car.entrySignal = signalColor(signal, previous.tick + fraction);
      }

      if (before.distance <= entryDistance && car.distance > entryDistance) {
        const fraction = (entryDistance - before.distance) / (car.distance - before.distance);

        car.enteredTick = previous.tick + fraction;
      }
    }

    if (car.distance < pathLength(path)) {
      continue;
    }

    if (car.segment === 'lane') {
      if (car.connectionId) {
        car.segment = 'junction';
        car.distance = 0;
        car.enteredTick ??= next.tick;
      }
    } else {
      const connection = network.connections.find((item) => item.id === car.connectionId)!;

      car.laneId = connection.toLaneId;
      car.connectionId = chooseConnectionId(network, state, car.laneId);
      car.segment = 'lane';
      car.distance = 0;
      car.stopped = false;
      car.waitingTicks = 0;
      car.reaction = null;
      car.enteredTick = null;
      car.entrySignal = null;
      car.vehicle.indicator = null;
    }
  }

  state.vehicles = state.vehicles.filter(
    (car) =>
      car.connectionId ||
      car.distance < pathLength(routePath(car, network)) ||
      pointDistance(car.vehicle, next.vehicle) < 80,
  );

  if (next.tick >= state.nextSpawnTick && state.vehicles.length < 8) {
    state.nextSpawnTick = next.tick + 360;

    const entries = network.lanes.filter((lane) => lane.startJunction === null);

    const lane = entries[randomIndex(state, entries.length)];

    const position = positionAlongPath([lane.from, lane.to], VEHICLE_LENGTH / 2);

    if (
      pointDistance(position, next.vehicle) > 80 &&
      state.vehicles.every((car) => pointDistance(position, car.vehicle) > 20)
    ) {
      state.vehicles.push(createTrafficVehicle(network, state, lane.id, VEHICLE_LENGTH / 2));
    }
  }

  next.traffic = state;
}
