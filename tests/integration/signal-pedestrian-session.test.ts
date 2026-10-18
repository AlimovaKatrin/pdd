import { expect, it } from 'vitest';
import { GameSession } from '../../src/use-cases/session/game-session';
import { emptyControls, emptyHistory } from '../../src/domain/world/model';
import { signalPedestrianCity } from '../fixtures/signal-pedestrian-city';

it('retries a pedestrian finishing on the new green and permits waiting for the crossing to clear', async () => {
  let id = 0;

  const session = new GameSession(
    signalPedestrianCity(),
    { load: async () => emptyHistory(), save: async () => {} },
    { getCandidates: async () => [] },
    { id: () => String(++id), date: () => '2026-10-18T12:00:00Z' },
  );

  await session.initialize();
  session.start();

  const snapshots = new Map<number, ReturnType<GameSession['getWorld']>>();

  function drive(yieldFirst = false) {
    for (let tick = 0; tick < 3000 && !session.getSnapshot().current; tick++) {
      const world = session.getWorld();

      snapshots.set(world.tick, world);

      const waiting = world.tick < (yieldFirst ? 2200 : 1800) && world.vehicle.y < 179;

      session.setControls({
        ...emptyControls(),
        throttle: !waiting && world.vehicle.speed < 4,
        brake: waiting,
      });
      session.step();
      expect(session.getSnapshot().collision).toBeNull();

      if (world.vehicle.y < 164) {
        break;
      }
    }
  }

  drive();
  expect(session.getSnapshot().current?.causes.map((item) => item.code)).toContain(
    'pedestrian-clearing',
  );

  const first = session.getWorld();

  session.retry();
  expect(session.getWorld()).toEqual(snapshots.get(session.getWorld().tick));
  drive();
  expect(session.getWorld()).toEqual(first);
  session.retry();
  drive(true);
  expect(session.getSnapshot().current).toBeNull();
  expect(session.getWorld().vehicle.y).toBeLessThan(164);
  expect(session.getSnapshot().history.violations).toHaveLength(2);
});
