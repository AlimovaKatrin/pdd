import { describe, expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, initialWorld } from '../../src/domain/world/model';
import { junctionDuty } from '../../src/domain/world/junction-duty';
import { compareJunctionPaths } from '../../src/domain/world/junction-priority';
import { createTrafficVehicle } from '../../src/domain/world/traffic-state';
import { positionAlongPath } from '../../src/domain/world/path-geometry';
import { stepWorld } from '../../src/domain/simulation/step';
import { priorityObstacle } from '../../src/domain/simulation/traffic-priority';

const network = expandedCity.network!;

const expectedCodes: Record<string, string> = {
  '13.9': 'priority-main',
  '13.11': 'priority-right',
  '13.12': 'priority-left-equal',
};

describe.each(network.junctions.filter((item) => item.control === 'priority'))(
  'all path pairs at $id',
  (junction) => {
    const routes = network.connections.filter((item) => item.junctionId === junction.id);

    it.each(routes)('$id uses the validated relation for every opposing route', (first) => {
      for (const second of routes) {
        const relation = compareJunctionPaths(junction, first, second);

        const expected = relation.yields === 'first' ? expectedCodes[relation.reference!] : null;

        expect(
          junctionDuty(
            expandedCity,
            { connectionId: first.id, enteredTick: null, entrySignal: null },
            { connectionId: second.id, enteredTick: null, entrySignal: null },
            0,
          ),
          second.id,
        ).toBe(expected);
      }
    });
  },
);

function scene() {
  const world = initialWorld(expandedCity);

  const route = network.connections.find((item) => item.id === 'city-160-40-west-straight')!;

  const car = createTrafficVehicle(network, world.traffic, route.fromLaneId, 3);

  car.connectionId = route.id;
  car.segment = 'junction';
  car.enteredTick = 200;
  Object.assign(car.vehicle, positionAlongPath(route.path, 3), { speed: 8 });
  world.traffic.vehicles = [car];
  world.traffic.nextSpawnTick = Infinity;
  world.tick = 300;
  Object.assign(world.vehicle, { x: 156.5, y: 38, heading: Math.PI / 2, speed: 4 });
  world.passageNumber = 1;
  world.junctionPassage = {
    junctionId: 'city-160-40',
    incomingLaneId: network.connections.find((item) => item.id === 'city-160-40-north-straight')!
      .fromLaneId,
    connectionId: 'city-160-40-north-straight',
    entryHeading: Math.PI / 2,
    enteredTick: 200,
    entrySignal: null,
    episode: 1,
    reported: [],
  };

  return world;
}

it('records the main road and a real additional reaction once, before contact', () => {
  const before = scene();

  const result = stepWorld(before, emptyControls(), expandedCity);

  const event = result.violations.find((item) => item.type === 'priority')!;

  expect(result.collision).toBeNull();
  expect(event.causes[0].code).toBe('priority-main');
  expect(event.causes[0].facts.playerPriority).toBe('secondary');
  expect(event.causes[0].facts.participantPriority).toBe('main');
  expect(event.causes[0].facts.actualSpeedKmh).toBeLessThan(
    Number(event.causes[0].facts.unimpededSpeedKmh),
  );
  expect(
    stepWorld(result.world, emptyControls(), expandedCity).violations.filter(
      (item) => item.type === 'priority',
    ),
  ).toEqual([]);
});

it('does not blame waiting, distance, or another vehicle causing the braking', () => {
  const world = scene();

  world.vehicle.y = 20;
  world.vehicle.speed = 0;
  world.junctionPassage!.enteredTick = null;
  expect(stepWorld(world, emptyControls(), expandedCity).violations).toEqual([]);

  const distant = scene();

  distant.traffic.vehicles[0].vehicle.x = 100;
  expect(stepWorld(distant, emptyControls(), expandedCity).violations).toEqual([]);

  const queued = scene();

  const blocker = structuredClone(queued.traffic.vehicles[0]);

  blocker.id = 'blocker';
  blocker.vehicle.x += 5;
  blocker.distance += 5;
  blocker.vehicle.speed = 0;
  queued.traffic.vehicles.push(blocker);
  expect(
    stepWorld(queued, emptyControls(), expandedCity)
      .violations.flatMap((item) => item.causes)
      .some((reason) => reason.facts.participantId === queued.traffic.vehicles[0].id),
  ).toBe(false);
});

it('does not keep yielding to a route whose conflict has already been cleared', () => {
  const world = scene();

  const car = world.traffic.vehicles[0];

  const left = network.connections.find((item) => item.id === 'city-160-40-east-left')!;

  car.connectionId = left.id;
  car.laneId = left.fromLaneId;
  car.distance = 26;
  Object.assign(car.vehicle, positionAlongPath(left.path, car.distance));
  world.junctionPassage!.connectionId = 'city-160-40-west-straight';
  Object.assign(world.vehicle, { x: 170, y: 43.5, heading: 0, speed: 8 });
  expect(priorityObstacle(car, world, expandedCity)).toBeNull();
});

it.each([
  ['north', 'south', 'secondary'],
  ['south', 'north', 'secondary'],
  ['east', 'west', 'main'],
  ['west', 'east', 'main'],
])(
  'detects a left turn from %s in front of an opposing %s car on equal-priority roads',
  (from, opposing, roadPriority) => {
    const route = network.connections.find((item) => item.id === `city-160-40-${from}-left`)!;

    const other = network.connections.find(
      (item) => item.id === `city-160-40-${opposing}-straight`,
    )!;

    const lane = network.lanes.find((item) => item.id === route.fromLaneId)!;

    let detected = false;

    for (let playerDistance = 5; playerDistance < 26 && !detected; playerDistance += 2) {
      for (let otherDistance = 2; otherDistance < 24 && !detected; otherDistance += 2) {
        const world = scene();

        Object.assign(world.vehicle, positionAlongPath(route.path, playerDistance));
        world.junctionPassage!.incomingLaneId = route.fromLaneId;
        world.junctionPassage!.connectionId = route.id;
        world.junctionPassage!.entryHeading = Math.atan2(
          lane.to.y - lane.from.y,
          lane.to.x - lane.from.x,
        );

        const car = world.traffic.vehicles[0];

        car.connectionId = other.id;
        car.laneId = other.fromLaneId;
        car.distance = otherDistance;
        Object.assign(car.vehicle, positionAlongPath(other.path, otherDistance));

        const result = stepWorld(world, emptyControls(), expandedCity);

        const event = result.violations.find((item) => item.type === 'priority');

        if (!result.collision && event) {
          expect(event.causes[0].code).toBe('priority-left-equal');
          expect(event.causes[0].facts.playerPriority).toBe(roadPriority);
          expect(event.causes[0].facts.participantPriority).toBe(roadPriority);
          detected = true;
        }
      }
    }

    expect(detected).toBe(true);
  },
);
