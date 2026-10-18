import type { Point } from './point';
import type { RoadNetwork } from './road-network';
import type { TrafficState, TrafficVehicle } from './vehicles';
import { pathLength, positionAlongPath, pointDistance } from './path-geometry';

export function randomIndex(state: TrafficState, count: number): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;

  return state.seed % count;
}

export function chooseConnectionId(
  network: RoadNetwork,
  state: TrafficState,
  laneId: string,
): string {
  const connections = network.connections.filter((item) => item.fromLaneId === laneId);

  return connections.length ? connections[randomIndex(state, connections.length)].id : '';
}

export function createTrafficVehicle(
  network: RoadNetwork,
  state: TrafficState,
  laneId: string,
  distance: number,
): TrafficVehicle {
  const lane = network.lanes.find((item) => item.id === laneId)!;

  const connectionId = chooseConnectionId(network, state, laneId);

  const number = state.nextId++;

  return {
    id: `traffic-${number}`,
    label: `М${number}`,
    vehicle: {
      ...positionAlongPath([lane.from, lane.to], distance),
      speed: 0,
      indicator: null,
      indicatorTurn: 0,
    },
    laneId,
    connectionId,
    segment: 'lane',
    distance,
    stopped: false,
    waitingTicks: 0,
    reaction: null,
    enteredTick: null,
    entrySignal: null,
  };
}

export function createTraffic(
  network: RoadNetwork | undefined,
  spawn: Point,
  seed = 301,
): TrafficState {
  const state: TrafficState = { vehicles: [], seed, nextId: 1, nextSpawnTick: 360 };

  if (!network) {
    return state;
  }

  const candidates = network.lanes.filter((lane) => lane.startJunction && lane.endJunction);

  while (candidates.length && state.vehicles.length < 6) {
    const [lane] = candidates.splice(randomIndex(state, candidates.length), 1);

    const vehicle = createTrafficVehicle(
      network,
      state,
      lane.id,
      pathLength([lane.from, lane.to]) / 2,
    );

    if (
      pointDistance(vehicle.vehicle, spawn) >= 60 &&
      state.vehicles.every((other) => pointDistance(other.vehicle, vehicle.vehicle) >= 20)
    ) {
      state.vehicles.push(vehicle);
    }
  }

  return state;
}
