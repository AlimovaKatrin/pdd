import { describe, expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { initialWorld, type World } from '../../src/domain/world/model';
import { createTrafficVehicle } from '../../src/domain/world/traffic-state';
import { pathLength, positionAlongPath } from '../../src/domain/world/path-geometry';
import { stepTraffic } from '../../src/domain/simulation/traffic';
import { STEP } from '../../src/domain/simulation/step';
import type { ApproachSide } from '../../src/domain/world/road-network';

const map = expandedCity;

const network = map.network!;

function setup(x: number, y: number, side: ApproachSide, movement = 'straight') {
  const world = initialWorld(map);

  world.vehicle.x = 310;
  world.vehicle.y = 310;
  world.traffic.vehicles = [];
  world.traffic.nextSpawnTick = Infinity;
  world.pedestrians = {};

  const junction = network.junctions.find((item) => item.x === x && item.y === y)!;

  const laneId = junction.approaches.find((item) => item.side === side)!.incomingLaneId;

  const lane = network.lanes.find((item) => item.id === laneId)!;

  const length = pathLength([lane.from, lane.to]);

  const car = createTrafficVehicle(network, world.traffic, laneId, Math.max(0, length - 25));

  car.connectionId = network.connections.find(
    (item) => item.fromLaneId === laneId && item.movement === movement,
  )!.id;
  car.vehicle.speed = 8;
  world.traffic.vehicles = [car];

  return { world, lane, car, length };
}

function advance(world: World, count: number, frozenTick?: number) {
  let next = world;

  for (let tick = 0; tick < count; tick++) {
    const previous = next;

    next = structuredClone(previous);
    next.tick = frozenTick ?? previous.tick + 1;
    stepTraffic(previous, next, map, STEP);
  }

  return next;
}

describe('traffic driving decisions', () => {
  it('stops before STOP, then starts a fresh approach with the same stable ID', () => {
    const { world, car, length } = setup(160, 40, 'south');

    let next = world;

    let stopped = false;

    for (let tick = 0; tick < 1200; tick++) {
      next = advance(next, 1);

      const current = next.traffic.vehicles[0];

      expect(current.id).toBe(car.id);

      if (current.stopped) {
        stopped = true;
      }

      if (current.laneId !== car.laneId) {
        expect(stopped).toBe(true);
        expect(current.stopped).toBe(false);

        return;
      }

      if (current.segment === 'lane' && !current.stopped) {
        expect(current.distance).toBeLessThanOrEqual(length - 3.1 + 0.001);
      }
    }

    throw new Error('Traffic did not finish its STOP approach');
  });

  it.each(['red', 'yellow', 'red-yellow'] as const)('waits on %s and resumes on green', (color) => {
    const { world, length } = setup(160, 160, 'south');

    const ticks = { red: 1000, yellow: 650, 'red-yellow': 1750 };

    world.tick = ticks[color];

    const stopped = advance(world, 360, world.tick);

    expect(stopped.traffic.vehicles[0].vehicle.speed).toBe(0);
    expect(stopped.traffic.vehicles[0].distance).toBeLessThanOrEqual(length - 3.1 + 0.001);
    expect(stopped.traffic.vehicles[0].reaction?.reason).toBe('signal');
    stopped.tick = 0;

    const moving = advance(stopped, 180, 0);

    expect(moving.traffic.vehicles[0].vehicle.speed).toBeGreaterThan(1);
    expect(moving.traffic.vehicles[0].segment).toBe('junction');
  });

  it('finishes a permitted entry after the signal changes', () => {
    const { world, car } = setup(160, 160, 'south');

    car.segment = 'junction';
    car.distance = 2;

    const connection = network.connections.find((item) => item.id === car.connectionId)!;

    Object.assign(car.vehicle, positionAlongPath(connection.path, car.distance));
    world.tick = 1000;

    const next = advance(world, 300, 1000);

    expect(next.traffic.vehicles[0].laneId).toBe(connection.toLaneId);
    expect(next.traffic.vehicles[0].vehicle.speed).toBeGreaterThan(0);
  });

  it.each(['left', 'right'])(
    'signals a %s turn before entry and cancels it on exit',
    (movement) => {
      const { world, car } = setup(280, 160, 'south', movement);

      let next = world;

      let signalled = false;

      for (let tick = 0; tick < 1800; tick++) {
        next = advance(next, 1);

        const current = next.traffic.vehicles[0];

        if (
          current.segment === 'lane' &&
          current.laneId === car.laneId &&
          current.vehicle.indicator === movement
        ) {
          signalled = true;
        }

        if (current.laneId !== car.laneId) {
          expect(signalled).toBe(true);
          expect(current.vehicle.indicator).toBeNull();
          expect(current.id).toBe(car.id);

          return;
        }
      }

      throw new Error('Traffic did not complete its turn');
    },
  );

  it('waits behind the player and restarts after the lane becomes free', () => {
    const { world, lane, car } = setup(280, 160, 'south');

    Object.assign(world.vehicle, positionAlongPath([lane.from, lane.to], car.distance + 15));

    const stopped = advance(world, 360);

    expect(stopped.traffic.vehicles[0].vehicle.speed).toBe(0);
    expect(stopped.traffic.vehicles[0].reaction).toMatchObject({
      reason: 'vehicle',
      participantId: 'player',
    });
    stopped.vehicle.x = 310;
    stopped.vehicle.y = 310;

    const resumed = advance(stopped, 120);

    expect(resumed.traffic.vehicles[0].vehicle.speed).toBeGreaterThan(1);
  });

  it.each(['north', 'south'] as const)(
    'yields to a walking pedestrian from the %s approach',
    (side) => {
      const { world, lane, car } = setup(40, side === 'north' ? 280 : 160, side);

      car.distance = side === 'north' ? 25 : 13;
      Object.assign(car.vehicle, positionAlongPath([lane.from, lane.to], car.distance));
      world.pedestrians['city-park-crossing'] = {
        progress: 0.2,
        waiting: 0,
        episode: 1,
        obstructed: false,
        reaction: null,
      };

      const stopped = advance(world, 360);

      expect(stopped.traffic.vehicles[0].vehicle.speed).toBe(0);
      expect(stopped.traffic.vehicles[0].reaction?.reason).toBe('pedestrian');
      expect(Math.abs(stopped.traffic.vehicles[0].vehicle.y - 220)).toBeGreaterThanOrEqual(5.09);
      stopped.pedestrians['city-park-crossing'].waiting = 100;

      expect(advance(stopped, 120).traffic.vehicles[0].vehicle.speed).toBeGreaterThan(1);
    },
  );
});

it('spawns only at unoccupied distant boundary entries and removes cars only at an exit', () => {
  let world = initialWorld(map);

  world.vehicle.x = -100;
  world.vehicle.y = -100;
  world.traffic.vehicles = [];

  let appeared = 0;

  let removed = 0;

  for (let tick = 0; tick < 7200; tick++) {
    const previous = world;

    world = advance(world, 1);

    for (const car of world.traffic.vehicles) {
      if (previous.traffic.vehicles.some((item) => item.id === car.id)) {
        continue;
      }

      appeared++;

      const lane = network.lanes.find((item) => item.id === car.laneId)!;

      expect(lane.startJunction).toBeNull();
      expect(car.segment).toBe('lane');
      expect(
        Math.hypot(car.vehicle.x - world.vehicle.x, car.vehicle.y - world.vehicle.y),
      ).toBeGreaterThan(80);
      expect(
        previous.traffic.vehicles.every(
          (item) => Math.hypot(item.vehicle.x - car.vehicle.x, item.vehicle.y - car.vehicle.y) > 20,
        ),
      ).toBe(true);
    }

    for (const car of previous.traffic.vehicles) {
      if (world.traffic.vehicles.some((item) => item.id === car.id)) {
        continue;
      }

      removed++;
      expect(car.segment).toBe('lane');
      expect(network.lanes.find((lane) => lane.id === car.laneId)!.endJunction).toBeNull();
    }
  }

  expect(appeared).toBeGreaterThan(8);
  expect(removed).toBeGreaterThan(0);

  // This checks two simulated minutes, not a wall-clock performance budget.
}, 30000);
