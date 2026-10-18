import { describe, expect, it } from 'vitest';
import { neighborhood } from '../../src/content/maps/neighborhood';
import { initialWorld } from '../../src/domain/world/model';
import { activeSpeedLimit } from '../../src/domain/world/traffic';
import { validateMap } from '../../src/domain/world/validate-map';
import { checkSpeed } from '../../src/domain/rules/speed';

describe('city speed limit', () => {
  it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])(
    'accepts 60 km/h and detects any excess once per episode at heading %s',
    (heading) => {
      const world = initialWorld(neighborhood);

      world.vehicle.heading = heading;
      world.vehicle.speed = 60 / 3.6;
      expect(activeSpeedLimit(neighborhood, world.vehicle).limit).toBe(60);
      expect(checkSpeed(world, neighborhood)).toEqual([]);
      world.vehicle.speed += 0.001;

      const events = checkSpeed(world, neighborhood);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        roadObjectId: 'city-60',
        episode: 1,
        causes: [{ code: 'city-speed-limit', reference: 'Пункт 10.2', facts: { limitKmh: 60 } }],
      });
      expect(checkSpeed(world, neighborhood)).toEqual([]);
      world.vehicle.speed = 60 / 3.6;
      expect(checkSpeed(world, neighborhood)).toEqual([]);
      world.vehicle.speed += 0.001;
      expect(checkSpeed(world, neighborhood)[0].episode).toBe(2);
    },
  );

  it('changes 60 → 30 → 60 at the front bumper, without duplicate city and sign violations', () => {
    const world = initialWorld(neighborhood);

    Object.assign(world.vehicle, { x: 32.89, y: 21, heading: 0, speed: 40 / 3.6 });
    expect(activeSpeedLimit(neighborhood, world.vehicle).limit).toBe(60);
    expect(checkSpeed(world, neighborhood)).toEqual([]);
    world.vehicle.x = 32.9;
    expect(activeSpeedLimit(neighborhood, world.vehicle).limit).toBe(30);
    expect(checkSpeed(world, neighborhood)[0].causes[0].code).toBe('speed-limit');
    world.vehicle.speed = 61 / 3.6;
    expect(checkSpeed(world, neighborhood)).toEqual([]);
    world.vehicle.x = 54.89;
    expect(activeSpeedLimit(neighborhood, world.vehicle).limit).toBe(30);
    world.vehicle.x = 54.9;
    expect(activeSpeedLimit(neighborhood, world.vehicle).limit).toBe(60);

    const events = checkSpeed(world, neighborhood);

    expect(events).toHaveLength(1);
    expect(events[0].causes[0].code).toBe('city-speed-limit');
    world.vehicle.x = 40;
    expect(checkSpeed(world, neighborhood)[0].episode).toBe(2);
    world.vehicle.x = 55;
    expect(checkSpeed(world, neighborhood)[0].episode).toBe(2);
  });

  it('restores the city limit after a lawful departure and on the opposite lane', () => {
    const world = initialWorld(neighborhood);

    Object.assign(world.vehicle, { x: 40, y: 21, heading: 0, speed: 30 / 3.6 });
    expect(checkSpeed(world, neighborhood)).toEqual([]);
    world.vehicle.x = 55;
    world.vehicle.speed = 60 / 3.6;
    expect(checkSpeed(world, neighborhood)).toEqual([]);
    Object.assign(world.vehicle, { x: 40, y: 15, heading: Math.PI });
    expect(activeSpeedLimit(neighborhood, world.vehicle).limit).toBe(60);
    expect(checkSpeed(world, neighborhood)).toEqual([]);
    world.vehicle.speed += 0.001;
    expect(checkSpeed(world, neighborhood)[0].causes[0].code).toBe('city-speed-limit');
  });

  it('requires a finite positive city limit and a unique ID', () => {
    for (const limit of [0, -1, NaN, Infinity]) {
      expect(() =>
        validateMap({ ...neighborhood, citySpeedLimit: { id: 'city', limit, reference: '10.2' } }),
      ).toThrow();
    }

    expect(() =>
      validateMap({
        ...neighborhood,
        citySpeedLimit: { id: 'east-30', limit: 60, reference: '10.2' },
      }),
    ).toThrow();
  });
});
