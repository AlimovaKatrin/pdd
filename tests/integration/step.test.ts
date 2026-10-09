import { expect, it } from 'vitest';
import { stepWorld } from '../../src/domain/simulation/step';
import { neighborhood } from '../../src/content/maps/neighborhood';
import { emptyControls, initialWorld } from '../../src/domain/world/model';
import { stopDistance } from '../../src/domain/rules/stop';

it('is deterministic and accepts braking before STOP then continuing', () => {
  let a = initialWorld(neighborhood);

  let b = initialWorld(neighborhood);

  const throttle = { ...emptyControls(), throttle: true };

  for (let i = 0; i < 138; i++) {
    a = stepWorld(a, throttle, neighborhood).world;
    b = stepWorld(b, throttle, neighborhood).world;
  }

  expect(a).toEqual(b);

  while (a.vehicle.speed > 0) {
    a = stepWorld(a, { ...emptyControls(), brake: true }, neighborhood).world;
  }

  const distance = stopDistance(a.vehicle, neighborhood.stops[0]);

  expect(distance).toBeGreaterThan(1.5);
  expect(distance).toBeLessThanOrEqual(3);

  for (let i = 0; i < 120; i++) {
    const result = stepWorld(a, throttle, neighborhood);

    expect(result.violations).toHaveLength(0);
    a = result.world;
  }

  expect(a.successfulManeuvers).toBe(1);
});
it('keeps the car on a road and stops at its boundary', () => {
  let world = initialWorld(neighborhood);

  world.vehicle.heading = 0;

  for (let i = 0; i < 600; i++) {
    world = stepWorld(world, { ...emptyControls(), throttle: true }, neighborhood).world;
  }

  expect(world.vehicle.x).toBeLessThan(70);
  expect(world.vehicle.speed).toBe(0);
});
