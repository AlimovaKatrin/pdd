import { describe, expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, initialWorld } from '../../src/domain/world/model';
import { junctionDuty } from '../../src/domain/world/junction-duty';
import { createTrafficVehicle } from '../../src/domain/world/traffic-state';
import { positionAlongPath } from '../../src/domain/world/path-geometry';
import { stepWorld } from '../../src/domain/simulation/step';
import { updatePlayerPassage } from '../../src/domain/world/junction-passage';

function scene() {
  const world = initialWorld(expandedCity);

  const network = expandedCity.network!;

  const route = network.connections.find((item) => item.id === 'city-160-160-north-straight')!;

  const car = createTrafficVehicle(network, world.traffic, route.fromLaneId, 5);

  car.connectionId = route.id;
  car.segment = 'junction';
  car.enteredTick = 200;
  car.entrySignal = 'green';
  Object.assign(car.vehicle, positionAlongPath(route.path, 5), { speed: 8 });
  world.traffic.vehicles = [car];
  world.traffic.nextSpawnTick = Infinity;
  world.tick = 300;
  Object.assign(world.vehicle, { x: 155.5, y: 160, heading: -Math.PI, speed: 4 });
  world.passageNumber = 1;
  world.junctionPassage = {
    junctionId: 'city-160-160',
    incomingLaneId: network.connections.find((item) => item.id === 'city-160-160-south-left')!
      .fromLaneId,
    connectionId: 'city-160-160-south-left',
    entryHeading: -Math.PI / 2,
    enteredTick: 200,
    entrySignal: 'green',
    episode: 1,
    reported: [],
  };

  return world;
}

describe('green left-turn priority', () => {
  it('makes the opposing left-turning car yield to the player using the same duty', () => {
    const world = scene();

    const route = expandedCity.network!.connections.find(
      (item) => item.id === 'city-160-160-north-left',
    )!;

    const car = world.traffic.vehicles[0];

    car.connectionId = route.id;
    Object.assign(car.vehicle, positionAlongPath(route.path, 5));
    world.junctionPassage!.connectionId = 'city-160-160-south-straight';
    Object.assign(world.vehicle, { x: 163.5, y: 170, heading: -Math.PI / 2 });

    const result = stepWorld(world, emptyControls(), expandedCity);

    expect(result.world.traffic.vehicles[0].vehicle.speed).toBeLessThan(car.vehicle.speed);
    expect(result.violations.filter((event) => event.type === 'priority')).toEqual([]);
  });

  it('records the extra braking caused by the player before physical contact', () => {
    const world = scene();

    const result = stepWorld(world, emptyControls(), expandedCity);

    const event = result.violations.find((item) => item.type === 'priority')!;

    expect(result.collision).toBeNull();
    expect(event.causes[0].code).toBe('priority-left-green');
    expect(event.causes[0].facts.participantId).toBe(world.traffic.vehicles[0].id);
    expect(event.causes[0].facts.actualSpeedKmh).toBeLessThan(
      Number(event.causes[0].facts.unimpededSpeedKmh),
    );
    expect(event.causes[0].facts.playerFrom).toBe('south');
    expect(event.causes[0].facts.participantFrom).toBe('north');

    const again = stepWorld(result.world, emptyControls(), expandedCity);

    expect(again.violations.filter((item) => item.type === 'priority')).toEqual([]);
  });

  it('accepts waiting before entry and a distant opposing car without a forced reaction', () => {
    const waiting = scene();

    Object.assign(waiting.vehicle, { x: 163.5, y: 180, heading: -Math.PI / 2, speed: 0 });
    waiting.junctionPassage!.enteredTick = null;

    expect(stepWorld(waiting, emptyControls(), expandedCity).violations).toEqual([]);

    const distant = scene();

    const car = distant.traffic.vehicles[0];

    const lane = expandedCity.network!.lanes.find((item) => item.id === car.laneId)!;

    car.segment = 'lane';
    car.distance = 56;
    car.enteredTick = null;
    car.entrySignal = null;
    Object.assign(car.vehicle, positionAlongPath([lane.from, lane.to], car.distance));
    expect(stepWorld(distant, emptyControls(), expandedCity).violations).toEqual([]);
  });

  it('does not attribute a queue or a forbidden signal to the player', () => {
    const world = scene();

    const leader = structuredClone(world.traffic.vehicles[0]);

    leader.id = 'leader';
    leader.distance += 5;
    leader.vehicle.y += 5;
    leader.vehicle.speed = 0;
    world.traffic.vehicles.push(leader);

    const result = stepWorld(world, emptyControls(), expandedCity);

    // The leading car may itself be obstructed; the following car brakes for its queue.
    expect(
      result.violations
        .flatMap((event) => event.causes)
        .some((reason) => reason.facts.participantId === world.traffic.vehicles[0].id),
    ).toBe(false);

    const red = scene();

    red.traffic.vehicles[0].entrySignal = 'red';
    expect(
      stepWorld(red, emptyControls(), expandedCity).violations.filter(
        (item) => item.type === 'priority',
      ),
    ).toEqual([]);
  });

  it('does not use right-side priority at a working signal or blame compatible paths', () => {
    const first = {
      connectionId: 'city-160-160-south-straight',
      enteredTick: null,
      entrySignal: null,
    };

    expect(
      junctionDuty(
        expandedCity,
        first,
        { ...first, connectionId: 'city-160-160-west-straight' },
        300,
      ),
    ).toBeNull();
    expect(
      junctionDuty(
        expandedCity,
        first,
        { ...first, connectionId: 'city-160-160-north-straight' },
        300,
      ),
    ).toBeNull();
    expect(
      junctionDuty(
        expandedCity,
        { ...first, connectionId: 'city-160-160-south-left' },
        { ...first, connectionId: 'city-160-160-north-straight' },
        600,
      ),
    ).toBeNull();
  });

  it('abandons the completed passage and assigns a new episode on another approach', () => {
    const before = scene();

    const left = structuredClone(before);

    Object.assign(left.vehicle, { x: 130, y: 156.5, heading: -Math.PI });
    updatePlayerPassage(before, left, expandedCity);
    expect(left.junctionPassage).toBeNull();

    const approaching = structuredClone(left);

    Object.assign(approaching.vehicle, { x: 163.5, y: 190, heading: -Math.PI / 2 });
    updatePlayerPassage(left, approaching, expandedCity);
    expect(approaching.junctionPassage?.episode).toBe(2);
    expect(approaching.junctionPassage?.reported).toEqual([]);
  });
});
