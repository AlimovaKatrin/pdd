import { prepareIncident } from '../../src/use-cases/session/prepare-incident';
import { rotateCentralScene } from '../fixtures/rotate-central-scene';
import { expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, emptyHistory, initialWorld } from '../../src/domain/world/model';
import { createTrafficVehicle } from '../../src/domain/world/traffic-state';
import { positionAlongPath } from '../../src/domain/world/path-geometry';
import { stepWorld } from '../../src/domain/simulation/step';

function scene() {
  const world = initialWorld(expandedCity);

  const network = expandedCity.network!;

  const route = network.connections.find((item) => item.id === 'city-160-160-east-straight')!;

  const playerRoute = network.connections.find(
    (item) => item.id === 'city-160-160-south-straight',
  )!;

  const car = createTrafficVehicle(network, world.traffic, route.fromLaneId, 3);

  car.connectionId = route.id;
  car.segment = 'junction';
  car.enteredTick = 1450;
  car.entrySignal = 'green';
  Object.assign(car.vehicle, positionAlongPath(route.path, 3), { speed: 8 });
  world.traffic.vehicles = [car];
  world.traffic.nextSpawnTick = Infinity;
  world.tick = 1850;
  Object.assign(world.vehicle, { x: 163.5, y: 162, heading: -Math.PI / 2, speed: 4 });
  world.passageNumber = 1;
  world.junctionPassage = {
    junctionId: 'city-160-160',
    incomingLaneId: playerRoute.fromLaneId,
    connectionId: playerRoute.id,
    entryHeading: -Math.PI / 2,
    enteredTick: 1802,
    entrySignal: 'green',
    episode: 1,
    reported: [],
  };

  return world;
}

it('records obstruction of a previous-phase car and reproduces the complete step', () => {
  const before = scene();

  const result = stepWorld(before, emptyControls(), expandedCity);

  expect(result.collision).toBeNull();
  expect(result.violations.find((item) => item.type === 'priority')?.causes[0].code).toBe(
    'priority-clearing',
  );
  expect(stepWorld(structuredClone(before), emptyControls(), expandedCity)).toEqual(result);
  expect(stepWorld(result.world, emptyControls(), expandedCity).violations).toEqual([]);

  const yielding = scene();

  yielding.vehicle.y = 180;
  yielding.vehicle.speed = 0;
  yielding.junctionPassage!.enteredTick = null;
  expect(stepWorld(yielding, emptyControls(), expandedCity).violations).toEqual([]);
});

it('does not reclassify a new or distant arrival as a car clearing the earlier phase', () => {
  const later = scene();

  later.traffic.vehicles[0].enteredTick = 1802;
  later.traffic.vehicles[0].entrySignal = 'red';
  expect(stepWorld(later, emptyControls(), expandedCity).violations).toEqual([]);

  const distant = scene();

  distant.traffic.vehicles[0].vehicle.x = 210;
  expect(stepWorld(distant, emptyControls(), expandedCity).violations).toEqual([]);
});

it.each([0, 1, 2, 3])('detects the priority reaction from each rotated approach (%s)', (turns) => {
  const world = rotateCentralScene(scene(), turns);

  const result = stepWorld(world, emptyControls(), expandedCity);

  expect(result.collision).toBeNull();
  expect(result.violations.find((item) => item.type === 'priority')?.causes[0].code).toBe(
    'priority-clearing',
  );
  expect(
    stepWorld(result.world, emptyControls(), expandedCity).violations.filter(
      (item) => item.type === 'priority',
    ),
  ).toEqual([]);
});

it('combines simultaneous confirmed priority and speed causes into one review', () => {
  const world = scene();

  const map = structuredClone(expandedCity);

  map.speedZones!.push({
    id: 'test-ten',
    x: 160,
    y: 150,
    width: 7,
    height: 20,
    limit: 10,
    direction: { x: 0, y: -1 },
    sign: { x: 167, y: 170 },
    end: { x: 167, y: 150 },
  });

  const result = stepWorld(world, emptyControls(), map);

  const [first, ...rest] = result.violations;

  if (!first) {
    throw new Error('The scene must produce confirmed violations');
  }

  const review = prepareIncident({
    violations: [first, ...rest],
    history: emptyHistory(),
    questions: [],
    tripId: 'trip',
    attemptId: 'attempt',
    mapVersion: map.version,
    environment: { id: () => 'event', date: () => '2026-10-18T12:00:00Z' },
  });

  expect(review.entry.causes.map((reason) => reason.code)).toContain('priority-clearing');
  expect(review.entry.causes.map((reason) => reason.code)).toContain('speed-limit');
  expect(
    review.entry.causes.find((reason) => reason.code === 'priority-clearing')!.reference,
  ).toContain('13.8');
  expect(review.entry.causes.find((reason) => reason.code === 'speed-limit')!.reference).toContain(
    '3.24',
  );
});
