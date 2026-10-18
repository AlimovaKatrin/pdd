import { describe, expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { checkOncoming } from '../../src/domain/rules/oncoming';
import { initialWorld, type Vehicle, type World } from '../../src/domain/world/model';
import { pathLength, positionAlongPath } from '../../src/domain/world/path-geometry';
import { worldAfterSafeReturn } from '../../src/domain/world/safe-return';

function move(world: World, vehicle: Partial<Vehicle>) {
  const next = structuredClone(world);

  Object.assign(next.vehicle, vehicle);
  next.tick++;

  return { next, events: checkOncoming(world, next, expandedCity) };
}

function starting(x = 163.5, y = 220, heading = -Math.PI / 2) {
  const world = initialWorld(expandedCity);

  Object.assign(world.vehicle, { x, y, heading, speed: 4 });

  return world;
}

describe('prohibited opposing lanes', () => {
  it('accepts touching the boundary and detects penetration by the body before the centre crosses', () => {
    const world = starting();

    expect(move(world, { x: 160.9 }).events).toEqual([]);
    expect(move(world, { x: 160.88 }).events[0].causes[0].code).toBe('oncoming-lane');
  });

  it('detects a swept crossing even when both endpoints are clear of the marking', () => {
    const result = move(starting(), { x: 156.5 });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].causes[0].reference).toContain('9.1(1)');
  });

  it('detects continued driving on the prohibited side and does not repeat while stopped', () => {
    const world = starting(156.5);

    expect(move(world, {}).events).toEqual([]);

    const first = move(world, { y: 219 });

    expect(first.events).toHaveLength(1);
    expect(move(first.next, { y: 218 }).events).toEqual([]);
    expect(move(first.next, { speed: 0 }).events).toEqual([]);
  });

  it('rearms only after returning to the proper lane, not while passing through a junction gap', () => {
    const first = move(starting(), { x: 156.5 });

    const gap = move(first.next, { y: 160 });

    expect(gap.events).toEqual([]);
    expect(gap.next.oncomingEpisode.active).toBe(true);

    const returned = move(first.next, { x: 163.5 });

    expect(returned.events).toEqual([]);

    const second = move(returned.next, { x: 156.5 });

    expect(second.events).toHaveLength(1);
    expect(second.events[0].episode).toBe(first.events[0].episode + 1);
  });

  it.each(expandedCity.network!.connections)(
    'accepts legal connection $id and its exit',
    (connection) => {
      const network = expandedCity.network!;

      const lane = network.lanes.find((item) => item.id === connection.fromLaneId)!;

      const outgoing = network.lanes.find((item) => item.id === connection.toLaneId)!;

      const path = [lane.from, ...connection.path, outgoing.to];

      let world = starting();

      Object.assign(world.vehicle, positionAlongPath(path, 0));

      for (let distance = 0.25; distance < pathLength(path); distance += 0.25) {
        const result = move(world, positionAlongPath(path, distance));

        expect(result.events, `${connection.id} at ${distance}`).toEqual([]);
        world = result.next;
      }
    },
  );

  it('rejects leaving the junction onto the opposite side but accepts the proper exit', () => {
    expect(move(starting(156.5, 148), { y: 140 }).events).toHaveLength(1);
    expect(move(starting(163.5, 148), { y: 140 }).events).toEqual([]);
  });

  it('does not synthesize a crossing on safe return and replays the same event from a snapshot', () => {
    const before = starting();

    const first = move(before, { x: 156.5 });

    expect(move(structuredClone(before), { x: 156.5 }).events).toEqual(first.events);

    const returned = worldAfterSafeReturn(expandedCity, first.next)!;

    expect(checkOncoming(first.next, returned, expandedCity)).toEqual([]);
    expect(move(returned, { y: returned.vehicle.y - 0.1 }).events).toEqual([]);
  });
});
