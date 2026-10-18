import { createTrafficVehicle } from '../../src/domain/world/traffic-state';
import { stepWorld } from '../../src/domain/simulation/step';
import { expect, it } from 'vitest';
import { vehicleContactFraction } from '../../src/domain/world/swept-vehicles';
import { vehiclesOverlap } from '../../src/domain/world/vehicle-geometry';
import { safeReturnVehicle } from '../../src/domain/world/safe-return';
import { emptyControls, initialWorld } from '../../src/domain/world/model';
import { expandedCity } from '../../src/content/maps/expanded-city';
import type { Vehicle } from '../../src/domain/world/vehicles';

function car(x: number, y: number, heading = 0): Vehicle {
  return { x, y, heading, speed: 0, indicator: null, indicatorTurn: 0 };
}

it('detects a high-speed pass through a stationary car even when both endpoints are clear', () => {
  const from = car(-20, 0);

  const to = car(20, 0);

  const other = car(0, 0, Math.PI / 2);

  expect(vehiclesOverlap(from, other)).toBe(false);
  expect(vehiclesOverlap(to, other)).toBe(false);
  expect(vehicleContactFraction(from, to, other, other)).toBeCloseTo(0.425);
});

it('detects two moving cars and keeps a separated parallel pass clear', () => {
  expect(
    vehicleContactFraction(
      car(-10, 0),
      car(10, 0),
      car(0, -10, Math.PI / 2),
      car(0, 10, Math.PI / 2),
    ),
  ).not.toBeNull();
  expect(vehicleContactFraction(car(-10, 1.801), car(10, 1.801), car(0, 0), car(0, 0))).toBeNull();
  expect(vehicleContactFraction(car(-10, 1.8), car(10, 1.8), car(0, 0), car(0, 0))).not.toBeNull();
});

it('includes a rotating corner instead of testing only the final rectangle', () => {
  expect(
    vehicleContactFraction(car(0, 0, 0), car(0, 0, Math.PI), car(0, 3), car(0, 3)),
  ).not.toBeNull();
  expect(
    vehicleContactFraction(car(0, 0, 0), car(0, 0, Math.PI), car(0, 10), car(0, 10)),
  ).toBeNull();
});

it('selects a free lane away from traffic and does not change the world while searching', () => {
  const world = initialWorld(expandedCity);

  const before = structuredClone(world);

  const position = safeReturnVehicle(expandedCity, world)!;

  expect(position.speed).toBe(0);
  expect(position.indicator).toBeNull();
  expect(
    expandedCity.network!.safePositions.some(
      (item) => item.x === position.x && item.y === position.y && item.heading === position.heading,
    ),
  ).toBe(true);
  expect(
    world.traffic.vehicles.every(
      (item) =>
        Math.hypot(item.vehicle.x - position.x, item.vehicle.y - position.y) >=
        Math.max(12, item.vehicle.speed * 3 + 6),
    ),
  ).toBe(true);
  expect(world).toEqual(before);
});

it('refuses a return if every candidate is occupied', () => {
  const world = initialWorld(expandedCity);

  const template = world.traffic.vehicles[0];

  world.traffic.vehicles = expandedCity.network!.safePositions.map((position, index) => ({
    ...template,
    id: `blocking-${index}`,
    vehicle: { ...template.vehicle, ...position },
  }));
  expect(safeReturnVehicle(expandedCity, world)).toBeNull();
});

it('keeps a line crossing before contact, but does not count travel beyond the contact point', () => {
  const map = {
    ...expandedCity,
    speedZones: [],
    stops: [
      { id: 'contact-stop', a: { x: 110, y: 40 }, b: { x: 110, y: 47 }, direction: { x: 1, y: 0 } },
    ],
  };

  const world = initialWorld(map);

  world.vehicle = { ...car(107.85, 43.5), speed: 12 };
  world.traffic.vehicles = [];
  world.traffic.nextSpawnTick = Infinity;

  const lane = map.network!.lanes.find((item) => item.from.x === 54 && item.from.y === 43.5)!;

  const other = createTrafficVehicle(map.network!, world.traffic, lane.id, 112.2 - 54);

  world.traffic.vehicles = [other];

  const result = stepWorld(world, emptyControls(), map);

  expect(result.collision).not.toBeNull();
  expect(result.violations.flatMap((item) => item.causes.map((cause) => cause.code))).toContain(
    'stop-line',
  );
  expect(result.world.vehicle.x).toBeGreaterThan(107.9);
  expect(result.world.vehicle.x).toBeLessThan(108.05);
});
