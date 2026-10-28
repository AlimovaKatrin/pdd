import { expect, it } from 'vitest';
import { GameSession } from '../../src/use-cases/session/game-session';
import { emptyControls, emptyHistory } from '../../src/domain/world/model';
import { equalRoadCity } from '../fixtures/equal-road-city';

it('restores a equal-road approach and lets the player yield to the car from the right', async () => {
  let id = 0;

  const session = new GameSession(
    equalRoadCity(),
    { load: async () => emptyHistory(), save: async () => {} },
    { getCandidates: async () => [] },
    { id: () => String(++id), date: () => '2026-10-18T12:00:00Z' },
  );

  await session.initialize();
  session.start();

  const snapshots = new Map<number, ReturnType<GameSession['getWorld']>>();

  function drive(yieldFirst = false) {
    for (let tick = 0; tick < 1600 && !session.getSnapshot().current; tick++) {
      const world = session.getWorld();

      snapshots.set(world.tick, world);

      const waiting = yieldFirst && world.tick < 850 && world.vehicle.x > 259;

      session.setControls({
        ...emptyControls(),
        throttle: !waiting && world.vehicle.speed < 4,
        brake: waiting,
      });
      session.step();
      expect(session.getSnapshot().collision).toBeNull();

      if (world.vehicle.x > 300) {
        break;
      }
    }
  }

  drive();

  const first = session.getSnapshot().current;

  expect(first?.causes.map((reason) => reason.code)).toContain('priority-right');

  const paused = session.getWorld();

  session.retry();
  expect(session.getWorld()).toEqual(snapshots.get(session.getWorld().tick));
  drive();
  expect(session.getWorld()).toEqual(paused);
  expect(session.getSnapshot().current!.attemptId).not.toBe(first!.attemptId);
  session.retry();
  drive(true);
  expect(session.getSnapshot().current).toBeNull();
  expect(session.getWorld().vehicle.x).toBeGreaterThan(300);
  expect(session.getSnapshot().history.violations).toHaveLength(2);
});
