import { createTrafficVehicle } from '../../src/domain/world/traffic-state';
import { positionAlongPath, pathLength } from '../../src/domain/world/path-geometry';
import { stepTrafficCar } from '../../src/domain/simulation/traffic-car';
import { expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { initialWorld, type World } from '../../src/domain/world/model';
import { stepPedestrians } from '../../src/domain/simulation/pedestrians';
import { validateMap } from '../../src/domain/world/validate-map';
import { pedestrianMayStart } from '../../src/domain/world/pedestrian-duty';

const crossingId = 'city-central-crossing';

function advance(before: World) {
  const next = structuredClone(before);

  next.tick++;

  const events = stepPedestrians(before, next, expandedCity, 1 / 60);

  return { next, events };
}

function encounter(turning: boolean) {
  const world = initialWorld(expandedCity);

  const route = expandedCity.network!.connections.find(
    (item) => item.id === `city-160-160-${turning ? 'west-right' : 'south-straight'}`,
  )!;

  world.tick = turning ? 1400 : 1850;
  Object.assign(world.vehicle, {
    x: turning ? 156.5 : 163.5,
    y: turning ? 168.5 : 176,
    heading: turning ? Math.PI / 2 : -Math.PI / 2,
    speed: 4,
  });
  world.junctionPassage = {
    junctionId: route.junctionId,
    incomingLaneId: route.fromLaneId,
    connectionId: route.id,
    entryHeading: turning ? 0 : -Math.PI / 2,
    enteredTick: turning ? 1350 : 1840,
    entrySignal: 'green',
    episode: 1,
    reported: [],
  };
  Object.assign(world.pedestrians[crossingId], {
    progress: turning ? 0.25 : 0.7,
    waiting: 0,
    startedTick: 1200,
  });

  return world;
}

it('starts only on the pedestrian green and finishes the crossing after it changes', () => {
  let world = initialWorld(expandedCity);

  world.pedestrians[crossingId].waiting = 0;
  world.tick = 800;
  expect(advance(world).next.pedestrians[crossingId].progress).toBe(0);
  world.tick = 1200;

  for (let step = 0; step < 700; step++) {
    world = advance(world).next;
  }

  expect(world.pedestrians[crossingId].progress).toBeCloseTo(1, 6);
  expect(world.pedestrians[crossingId].startedTick).toBe(1200);
  expect(pedestrianMayStart(expandedCity.crossings![0], expandedCity, world.tick)).toBe(false);
});

it.each([true, false])(
  'records the applicable duty, replays the reaction and deduplicates (turn %s)',
  (turning) => {
    const before = encounter(turning);

    const result = advance(before);

    expect(result.events.map((event) => event.causes[0].code)).toContain(
      turning ? 'pedestrian-turn' : 'pedestrian-clearing',
    );
    expect(result.events[0].causes[0].facts.participantId).toBe(crossingId);
    expect(advance(structuredClone(before))).toEqual(result);
    expect(advance(result.next).events).toEqual([]);

    const waiting = encounter(turning);

    waiting.vehicle.y = turning ? 165 : 180;
    waiting.vehicle.speed = 0;
    expect(advance(waiting).events).toEqual([]);
    expect(advance(waiting).next.pedestrians[crossingId].progress).toBeGreaterThan(
      waiting.pedestrians[crossingId].progress,
    );
  },
);

it('does not call a red waiting pedestrian an obstruction or infer priority from proximity', () => {
  const world = encounter(false);

  world.pedestrians[crossingId].progress = 0;
  world.pedestrians[crossingId].startedTick = null;
  expect(advance(world).events).toEqual([]);

  const nearby = encounter(false);

  nearby.vehicle.x = 156.5;
  nearby.vehicle.speed = 0;
  expect(advance(nearby).events).toEqual([]);
});

it('rejects broken links from a regulated crossing instead of guessing a signal or road', () => {
  expect(() => validateMap(expandedCity)).not.toThrow();

  const invalid = structuredClone(expandedCity);

  invalid.crossings![0].signalId = 'missing';
  expect(() => validateMap(invalid)).toThrow();
  invalid.crossings![0].signalId = expandedCity.crossings![0].signalId;
  invalid.crossings![0].outgoingLaneId = 'missing';
  expect(() => validateMap(invalid)).toThrow();
});

it.each(['south-straight', 'west-right'])(
  'makes traffic yield on %s and resume after the pedestrian clears',
  (movement) => {
    const world = initialWorld(expandedCity);

    const network = expandedCity.network!;

    const route = network.connections.find((item) => item.id === `city-160-160-${movement}`)!;

    const lane = network.lanes.find((item) => item.id === route.fromLaneId)!;

    const turning = movement === 'west-right';

    const path = turning ? route.path : [lane.from, lane.to];

    const distance = turning ? 10 : pathLength(path) - 5;

    const car = createTrafficVehicle(network, world.traffic, lane.id, distance);

    car.connectionId = route.id;
    car.segment = turning ? 'junction' : 'lane';
    car.enteredTick = turning ? 1200 : null;
    car.entrySignal = turning ? 'green' : null;
    Object.assign(car.vehicle, positionAlongPath(path, distance), { speed: turning ? 4 : 8 });
    world.traffic.vehicles = [car];
    world.vehicle.x = -100;
    world.vehicle.y = -100;
    world.tick = turning ? 1400 : 1850;
    Object.assign(world.pedestrians[crossingId], { waiting: 0, progress: 0.5, startedTick: 1200 });

    const stopped = stepTrafficCar(car, world, expandedCity, 1 / 60);

    expect(stopped.reaction?.reason).toBe('pedestrian');
    expect(stopped.vehicle.speed).toBeLessThan(car.vehicle.speed);
    world.pedestrians[crossingId].waiting = 100;

    const cleared = stepTrafficCar(stopped, world, expandedCity, 1 / 60);

    expect(cleared.reaction).toBeNull();
    expect(cleared.vehicle.speed).toBeGreaterThan(stopped.vehicle.speed);
  },
);
