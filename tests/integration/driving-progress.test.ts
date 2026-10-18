import { describe, expect, it } from 'vitest';
import { neighborhood } from '../../src/content/maps/neighborhood';
import { checkTurn } from '../../src/domain/maneuvers/turn';
import { stepPedestrians } from '../../src/domain/simulation/pedestrians';
import { checkSignals } from '../../src/domain/rules/signals';
import { checkSpeed } from '../../src/domain/rules/speed';
import { initialWorld, type Vehicle, type World } from '../../src/domain/world/model';
import { updateDrivingProgress } from '../../src/domain/simulation/driving-progress';
import { cause } from '../../src/domain/violations/causes';

function advance(previous: World, vehicle: Partial<Vehicle> = {}) {
  const next = structuredClone(previous);

  next.tick++;
  Object.assign(next.vehicle, vehicle);

  const violations = [
    ...checkSignals(previous, next, neighborhood),
    ...checkTurn(previous, next, neighborhood),
    ...checkSpeed(next, neighborhood),
    ...stepPedestrians(previous, next, neighborhood, 1 / 60),
  ];

  updateDrivingProgress(previous, next, neighborhood, violations);

  return next;
}

describe('successful driving situations', () => {
  it('does not count a signalled turn as correct after a priority violation', () => {
    let world = initialWorld(neighborhood);

    Object.assign(world.vehicle, { x: 64, y: 50, heading: 0, speed: 4, indicator: 'right' });
    world = advance(world);

    const turning = advance(world, { heading: 0.8 });

    updateDrivingProgress(world, turning, neighborhood, [
      {
        type: 'priority',
        roadObjectId: turning.maneuver!.intersectionId,
        episode: 1,
        tick: turning.tick,
        speed: 4,
        causes: [cause('priority-left-green', {})],
      },
    ]);
    expect(advance(turning, { x: 80, heading: Math.PI / 2 }).successfulManeuvers).toBe(0);
  });

  it.each(['left', 'right'] as const)(
    'counts one completed %s turn, not its intermediate steps',
    (side) => {
      let w = initialWorld(neighborhood);

      Object.assign(w.vehicle, { x: 64, y: 50, heading: 0, speed: 4, indicator: side });

      const direction = side === 'right' ? 1 : -1;

      w = advance(w);
      w = advance(w, { heading: 0.1 * direction });
      w = advance(w, { heading: 0.8 * direction });
      w = advance(w, { speed: 0 });
      expect(w.successfulManeuvers).toBe(0);
      w = advance(w, { x: 80, speed: 4, heading: (direction * Math.PI) / 2 });
      expect(w.successfulManeuvers).toBe(1);
      expect(advance(w).successfulManeuvers).toBe(1);
      w.vehicle.heading = 0;
      w.vehicle.indicator = side;
      w = advance(w, { x: 64 });
      w = advance(w, { heading: 0.8 * direction });
      w = advance(w, { x: 80, heading: (direction * Math.PI) / 2 });
      expect(w.successfulManeuvers).toBe(2);
    },
  );

  it.each(['missing', 'late', 'wrong', 'early-off', 'reverse', 'straight'] as const)(
    'does not award an invalid or uncompleted turn: %s',
    (scenario) => {
      let w = initialWorld(neighborhood);

      Object.assign(w.vehicle, {
        x: 64,
        y: 50,
        heading: 0,
        speed: 4,
        indicator:
          scenario === 'missing' || scenario === 'late'
            ? null
            : scenario === 'wrong'
              ? 'left'
              : 'right',
      });
      w = advance(w);
      w = advance(w, { heading: 0.1 });
      w = advance(w, { heading: scenario === 'straight' ? 0.1 : 0.8 });

      if (scenario === 'late') {
        w = advance(w, { indicator: 'right' });
      }

      if (scenario === 'early-off') {
        w = advance(w, { indicator: null });
      }

      w = advance(w, {
        x: 80,
        speed: scenario === 'reverse' ? -1 : 4,
        heading: scenario === 'straight' ? 0.1 : Math.PI / 2,
      });
      expect(w.successfulManeuvers).toBe(0);
    },
  );

  it('awards only green crossings, once per approach; yellow is not a verified success', () => {
    for (const tick of [0, 480, 660, 1140]) {
      let w = initialWorld(neighborhood);

      w.tick = tick;
      Object.assign(w.vehicle, { x: 107.5, y: 61.2, speed: 6 });
      w = advance(w, { y: 61 });

      const expected = tick === 0 ? 1 : 0;

      expect(w.successfulManeuvers).toBe(expected);
      expect(advance(w, { y: 60 }).successfulManeuvers).toBe(expected);
    }
  });

  function speedApproach() {
    const w = initialWorld(neighborhood);

    Object.assign(w.vehicle, { x: 32.8, y: 21, heading: 0, speed: 30 / 3.6 });

    return w;
  }

  it('awards a complete speed zone traversal at the exact limit, then rearms', () => {
    let w = advance(speedApproach(), { x: 33 });

    w = advance(w, { x: 45 });
    expect(w.successfulManeuvers).toBe(0);

    const snapshot = structuredClone(w);

    w = advance(w, { x: 55 });
    expect(w.successfulManeuvers).toBe(1);
    expect(advance(snapshot, { x: 55 })).toEqual(w);
    expect(advance(w, { x: 56 }).successfulManeuvers).toBe(1);
    w = advance(w, { x: 32.8 });
    w = advance(w, { x: 33 });
    w = advance(w, { x: 55 });
    expect(w.successfulManeuvers).toBe(2);
  });
  it.each(['excess', 'side-exit', 'reverse', 'start-inside'] as const)(
    'rejects an incomplete or violated speed passage: %s',
    (scenario) => {
      let w = speedApproach();

      if (scenario === 'start-inside') {
        w.vehicle.x = 40;
      }

      w = advance(w, { x: 41 });
      w = advance(w, {
        x: 45,
        speed: scenario === 'excess' ? 30 / 3.6 + 0.001 : scenario === 'reverse' ? -1 : 5,
        y: scenario === 'side-exit' ? 26 : 21,
      });
      w = advance(w, { x: 55, y: 21, speed: 5 });
      expect(w.successfulManeuvers).toBe(0);
    },
  );

  function yieldingWorld() {
    const w = initialWorld(neighborhood);

    Object.assign(w.vehicle, { x: 20.5, y: 63, heading: Math.PI / 2, speed: 0 });
    w.pedestrians['park-crossing'].progress = 0.25;

    return w;
  }

  it('counts yielding after the pedestrian finishes, not every waiting frame or pedestrian cycle', () => {
    let w = advance(yieldingWorld());

    expect(w.successfulManeuvers).toBe(0);

    for (let i = 0; i < 1800; i++) {
      w = advance(w);
    }

    expect(w.successfulManeuvers).toBe(1);
    // A fresh approach can complete another encounter.
    w = advance(w, { y: 30 });
    w.pedestrians['park-crossing'].progress = 0.25;
    w.pedestrians['park-crossing'].waiting = 0;
    w = advance(w, { y: 63 });

    for (let i = 0; i < 600; i++) {
      w = advance(w);
    }

    expect(w.successfulManeuvers).toBe(2);
  });
  it.each(['obstructed', 'empty', 'far-away', 'departed', 'already-cleared-lane'] as const)(
    'does not mistake %s for yielding',
    (scenario) => {
      let w = yieldingWorld();

      if (scenario === 'obstructed') {
        w = advance(w, { y: 64, speed: 6 });
        expect(w.pedestrians['park-crossing'].obstructed).toBe(true);
        w.vehicle.speed = 0;
        w.vehicle.y = 63;
      }

      if (scenario === 'empty') {
        w.pedestrians['park-crossing'].progress = 1;
        w.pedestrians['park-crossing'].waiting = 300;
      } else {
        w.pedestrians['park-crossing'].progress = 0.999;
      }

      if (scenario === 'departed') {
        w = advance(w, { y: 30 });
      }

      w = advance(w, { y: scenario === 'far-away' || scenario === 'departed' ? 30 : 63 });
      expect(w.successfulManeuvers).toBe(0);
    },
  );
  it('does not mutate the previous world or award stationary driving on an empty street', () => {
    const previous = initialWorld(neighborhood);

    const snapshot = structuredClone(previous);

    let w = previous;

    for (let i = 0; i < 300; i++) {
      w = advance(w);
    }

    expect(previous).toEqual(snapshot);
    expect(w.successfulManeuvers).toBe(0);
  });
});
