import { vehiclesOverlap } from '../../src/domain/world/vehicle-geometry';
import { describe, expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, initialWorld } from '../../src/domain/world/model';
import { stepWorld } from '../../src/domain/simulation/step';
import { activeSpeedLimit } from '../../src/domain/world/traffic';
import { pointDistance } from '../../src/domain/world/path-geometry';

const map = expandedCity;

describe('calm city traffic', () => {
  it('replays the same seeded world and keeps cars outside the camera moving', () => {
    let first = initialWorld(map);

    let second = initialWorld(map);

    const initial = structuredClone(first.traffic);

    for (let tick = 0; tick < 600; tick++) {
      first = stepWorld(first, emptyControls(), map).world;
      second = stepWorld(second, emptyControls(), map).world;
    }

    expect(first).toEqual(second);
    expect(first.traffic).not.toEqual(initial);
    expect(
      first.traffic.vehicles.some(
        (car) => pointDistance(car.vehicle, first.vehicle) > 100 && car.vehicle.speed > 0,
      ),
    ).toBe(true);
    expect(first.traffic.vehicles.length).toBeLessThanOrEqual(8);
  });

  it('keeps a ten-minute ordinary flow bounded, moving and below applicable speed limits', () => {
    let world = initialWorld(map);

    let movingFrames = 0;

    for (let tick = 0; tick < 36000; tick++) {
      world = stepWorld(world, emptyControls(), map).world;

      if (tick % 60 !== 0) {
        continue;
      }

      expect(world.traffic.vehicles.length).toBeLessThanOrEqual(8);

      if (world.traffic.vehicles.some((car) => car.vehicle.speed > 0.5)) {
        movingFrames++;
      }

      for (const car of world.traffic.vehicles) {
        expect(car.vehicle.speed * 3.6).toBeLessThanOrEqual(
          activeSpeedLimit(map, car.vehicle).limit,
        );
        expect(Number.isFinite(car.vehicle.x + car.vehicle.y)).toBe(true);

        for (const other of world.traffic.vehicles) {
          if (car.id !== other.id) {
            expect(vehiclesOverlap(car.vehicle, other.vehicle)).toBe(false);
          }
        }
      }
    }

    expect(movingFrames).toBeGreaterThan(500);
  }, 30000);
});

it.each([301, 42, 729])(
  'does not leave permanent queues in an unobstructed city (seed %s)',
  (seed) => {
    let world = initialWorld(map);

    world.vehicle.x = -100;
    world.vehicle.y = -100;
    world.traffic.seed = seed;

    for (let tick = 0; tick < 10800; tick++) {
      world = stepWorld(world, emptyControls(), map).world;

      if (tick % 60 === 0) {
        for (const car of world.traffic.vehicles) {
          expect(car.waitingTicks, `${car.id}: ${JSON.stringify(car.reaction)}`).toBeLessThan(3600);
        }
      }
    }
  },
  15000,
);
