import { describe, expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, initialWorld } from '../../src/domain/world/model';
import { activeSpeedLimit } from '../../src/domain/world/traffic';
import { displayedSpeed } from '../../src/presentation/view-models/driving-speed';
import { STEP, stepWorld } from '../../src/domain/simulation/step';
import { stepTraffic } from '../../src/domain/simulation/traffic';
import { createTrafficVehicle } from '../../src/domain/world/traffic-state';
import { positionAlongPath } from '../../src/domain/world/path-geometry';
import { worldAfterSafeReturn } from '../../src/domain/world/safe-return';

const map = expandedCity;

describe('shared speed context', () => {
  it('uses the road direction and front bumper on the expanded map', () => {
    const world = initialWorld(map);

    Object.assign(world.vehicle, { x: 65.89, y: 43.5, heading: 0 });
    expect(activeSpeedLimit(map, world.vehicle).limit).toBe(60);
    world.vehicle.x = 65.9;
    expect(activeSpeedLimit(map, world.vehicle).limit).toBe(30);
    world.vehicle.x = 143.89;
    expect(activeSpeedLimit(map, world.vehicle).limit).toBe(30);
    world.vehicle.x = 143.9;
    expect(activeSpeedLimit(map, world.vehicle).limit).toBe(60);
    Object.assign(world.vehicle, { x: 100, y: 36.5, heading: Math.PI });
    expect(activeSpeedLimit(map, world.vehicle).limit).toBe(60);
    expect(map.citySpeedLimit.reference).toBe('10.2');
  });

  it('keeps the city limit on an outgoing turn and derives the limit again after safe return', () => {
    const world = initialWorld(map);

    const connection = map.network!.connections.find(
      (item) => item.id === 'city-160-40-west-right',
    )!;

    const lane = map.network!.lanes.find((item) => item.id === connection.toLaneId)!;

    Object.assign(world.vehicle, positionAlongPath([lane.from, lane.to], 30));
    expect(activeSpeedLimit(map, world.vehicle).limit).toBe(60);

    const returned = worldAfterSafeReturn(map, world)!;

    expect(activeSpeedLimit(map, returned.vehicle).limit).toBe(60);
    expect(returned.vehicle.speed).toBe(0);
  });

  it.each([
    [30, 30, 30],
    [30.001, 30, 31],
    [60.001, 60, 61],
    [29.6, 30, 30],
    [0, 60, 0],
  ])('shows %s km/h with limit %s as %s without hiding an excess', (speed, limit, expected) => {
    expect(displayedSpeed(speed, limit)).toBe(expected);
  });

  it('keeps the handling ceiling at 12 m/s independently of the city limit', () => {
    const world = initialWorld(map);

    world.vehicle.speed = 12;

    const result = stepWorld(world, { ...emptyControls(), throttle: true }, map);

    expect(result.world.vehicle.speed).toBe(12);
    expect(result.violations).toEqual([]);
  });

  it('brakes before a lower sign and obeys the same limit at every step', () => {
    const custom = { ...map, speedZones: [{ ...map.speedZones![0], limit: 10 }] };

    let world = initialWorld(custom);

    world.vehicle.x = -100;
    world.vehicle.y = -100;
    world.traffic.vehicles = [];
    world.traffic.nextSpawnTick = Infinity;

    const lane = map.network!.lanes.find((item) => item.from.x === 54 && item.from.y === 43.5)!;

    const car = createTrafficVehicle(map.network!, world.traffic, lane.id, 0);

    car.connectionId = map.network!.connections.find(
      (item) => item.fromLaneId === lane.id && item.movement === 'straight',
    )!.id;
    car.vehicle.speed = 8;
    world.traffic.vehicles = [car];

    let brakedBeforeSign = false;

    let entered = false;

    let left = false;

    for (let tick = 0; tick < 2500; tick++) {
      const next = structuredClone(world);

      next.tick++;
      stepTraffic(world, next, custom, STEP);
      world = next;

      const vehicle = world.traffic.vehicles[0].vehicle;

      const limit = activeSpeedLimit(custom, vehicle).limit;

      expect(vehicle.speed * 3.6).toBeLessThanOrEqual(limit + 1e-9);

      if (!entered && limit === 60 && vehicle.speed < 7) {
        brakedBeforeSign = true;
      }

      if (limit === 10) {
        entered = true;
      }

      if (entered && limit === 60) {
        left = true;
        break;
      }
    }

    expect(brakedBeforeSign).toBe(true);
    expect(entered).toBe(true);
    expect(left).toBe(true);
  });
});
