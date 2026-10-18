import { describe, expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, initialWorld } from '../../src/domain/world/model';
import { junctionDuty } from '../../src/domain/world/junction-duty';
import { compareJunctionPaths } from '../../src/domain/world/junction-priority';
import { createTrafficVehicle } from '../../src/domain/world/traffic-state';
import { positionAlongPath } from '../../src/domain/world/path-geometry';
import { stepWorld } from '../../src/domain/simulation/step';

const network = expandedCity.network!;

const expectedCodes: Record<string, string> = {
  '13.9': 'priority-main',
  '13.11': 'priority-right',
  '13.12': 'priority-left-equal',
};

describe.each(network.junctions.filter((item) => item.control === 'equal'))(
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

  const route = network.connections.find((item) => item.id === 'city-280-160-south-straight')!;

  const car = createTrafficVehicle(network, world.traffic, route.fromLaneId, 3);

  car.connectionId = route.id;
  car.segment = 'junction';
  car.enteredTick = 200;
  Object.assign(car.vehicle, positionAlongPath(route.path, 3), { speed: 8 });
  world.traffic.vehicles = [car];
  world.traffic.nextSpawnTick = Infinity;
  world.tick = 300;
  Object.assign(world.vehicle, { x: 278, y: 163.5, heading: 0, speed: 4 });
  world.passageNumber = 1;
  world.junctionPassage = {
    junctionId: 'city-280-160',
    incomingLaneId: network.connections.find((item) => item.id === 'city-280-160-west-straight')!
      .fromLaneId,
    connectionId: 'city-280-160-west-straight',
    entryHeading: 0,
    enteredTick: 200,
    entrySignal: null,
    episode: 1,
    reported: [],
  };

  return world;
}

it('records right-side priority and a real additional reaction once, before contact', () => {
  const before = scene();

  const result = stepWorld(before, emptyControls(), expandedCity);

  const event = result.violations.find((item) => item.type === 'priority')!;

  expect(result.collision).toBeNull();
  expect(event.causes[0].code).toBe('priority-right');
  expect(event.causes[0].facts.playerPriority).toBe('equal');
  expect(event.causes[0].facts.participantPriority).toBe('equal');
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

  world.vehicle.x = 260;
  world.vehicle.speed = 0;
  world.junctionPassage!.enteredTick = null;
  expect(stepWorld(world, emptyControls(), expandedCity).violations).toEqual([]);

  const distant = scene();

  distant.traffic.vehicles[0].vehicle.y = 220;
  expect(stepWorld(distant, emptyControls(), expandedCity).violations).toEqual([]);

  const queued = scene();

  const blocker = structuredClone(queued.traffic.vehicles[0]);

  blocker.id = 'blocker';
  blocker.vehicle.y -= 5;
  blocker.distance += 5;
  blocker.vehicle.speed = 0;
  queued.traffic.vehicles.push(blocker);
  expect(
    stepWorld(queued, emptyControls(), expandedCity)
      .violations.flatMap((item) => item.causes)
      .some((reason) => reason.facts.participantId === queued.traffic.vehicles[0].id),
  ).toBe(false);
});

it.each([
  ['north', 'south', 'equal'],
  ['south', 'north', 'equal'],
  ['east', 'west', 'equal'],
  ['west', 'east', 'equal'],
])(
  'detects a left turn from %s in front of an opposing %s car on equal-priority roads',
  (from, opposing, roadPriority) => {
    const route = network.connections.find((item) => item.id === `city-280-160-${from}-left`)!;

    const other = network.connections.find(
      (item) => item.id === `city-280-160-${opposing}-straight`,
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

it.each([0, 1, 2, 3])(
  'detects right-side priority after rotating the approach by %s quarter turns',
  (turns) => {
    const world = scene();

    const sides = ['north', 'east', 'south', 'west'];

    const playerRoute = network.connections.find(
      (item) => item.id === `city-280-160-${sides[(3 + turns) % 4]}-straight`,
    )!;

    const otherRoute = network.connections.find(
      (item) => item.id === `city-280-160-${sides[(2 + turns) % 4]}-straight`,
    )!;

    const angle = (turns * Math.PI) / 2;

    for (const vehicle of [world.vehicle, world.traffic.vehicles[0].vehicle]) {
      const x = vehicle.x - 280;

      const y = vehicle.y - 160;

      vehicle.x = 280 + Math.cos(angle) * x - Math.sin(angle) * y;
      vehicle.y = 160 + Math.sin(angle) * x + Math.cos(angle) * y;
      vehicle.heading += angle;
    }

    world.junctionPassage!.connectionId = playerRoute.id;
    world.junctionPassage!.incomingLaneId = playerRoute.fromLaneId;
    world.junctionPassage!.entryHeading += angle;
    world.traffic.vehicles[0].connectionId = otherRoute.id;
    world.traffic.vehicles[0].laneId = otherRoute.fromLaneId;

    const result = stepWorld(world, emptyControls(), expandedCity);

    expect(result.collision).toBeNull();
    expect(result.violations.find((item) => item.type === 'priority')?.causes[0].code).toBe(
      'priority-right',
    );
  },
);

it('lets a waiting car proceed when the conflicting right-side participant leaves', () => {
  const world = scene();

  const route = network.connections.find((item) => item.id === 'city-280-160-west-straight')!;

  const lane = network.lanes.find((item) => item.id === route.fromLaneId)!;

  const car = createTrafficVehicle(network, world.traffic, route.fromLaneId, 88.9);

  car.connectionId = route.id;
  car.vehicle.speed = 0;
  Object.assign(car.vehicle, positionAlongPath([lane.from, lane.to], car.distance));
  world.vehicle.x = -100;
  world.vehicle.y = -100;
  world.junctionPassage = null;
  world.traffic.vehicles.push(car);

  const waiting = stepWorld(world, emptyControls(), expandedCity).world;

  expect(waiting.traffic.vehicles.find((item) => item.id === car.id)!.vehicle.speed).toBe(0);
  waiting.traffic.vehicles = waiting.traffic.vehicles.filter((item) => item.id === car.id);

  let next = waiting;

  for (let tick = 0; tick < 180; tick++) {
    next = stepWorld(next, emptyControls(), expandedCity).world;
  }

  expect(next.traffic.vehicles[0].vehicle.speed).toBeGreaterThan(1);
  expect(next.traffic.vehicles[0].vehicle.x).toBeGreaterThan(car.vehicle.x);
});

it('allows compatible right turns instead of treating every nearby car as an obstacle', () => {
  const world = scene();

  const playerRoute = network.connections.find((item) => item.id === 'city-280-160-west-right')!;

  const otherRoute = network.connections.find((item) => item.id === 'city-280-160-south-right')!;

  Object.assign(world.vehicle, positionAlongPath(playerRoute.path, 4));
  world.junctionPassage!.connectionId = playerRoute.id;
  Object.assign(world.traffic.vehicles[0].vehicle, positionAlongPath(otherRoute.path, 4));
  world.traffic.vehicles[0].connectionId = otherRoute.id;
  world.traffic.vehicles[0].distance = 4;

  const result = stepWorld(world, emptyControls(), expandedCity);

  expect(result.violations.filter((item) => item.type === 'priority')).toEqual([]);
  expect(result.world.traffic.vehicles[0].reaction).toBeNull();
});
