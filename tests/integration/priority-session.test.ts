import { expect, it } from 'vitest';
import { GameSession } from '../../src/use-cases/session/game-session';
import { emptyControls, emptyHistory, type History } from '../../src/domain/world/model';
import { priorityCity } from '../fixtures/priority-city';

it('replays both cars and their intentions, preserves history, and allows yielding instead', async () => {
  let saved: History = emptyHistory();

  let id = 0;

  const session = new GameSession(
    priorityCity(),
    {
      load: async () => saved,
      save: async (history) => {
        saved = structuredClone(history);
      },
    },
    { getCandidates: async () => [] },
    {
      id: () => String(++id),
      date: () => '2026-10-18T12:00:00Z',
    },
  );

  await session.initialize();
  session.start();
  session.toggleIndicator('left');

  const snapshots = new Map<number, ReturnType<GameSession['getWorld']>>();

  function drive(yieldFirst = false) {
    for (let tick = 0; tick < 1200 && !session.getSnapshot().current; tick++) {
      const world = session.getWorld();

      snapshots.set(world.tick, world);

      const vehicle = world.vehicle;

      const waiting = yieldFirst && world.tick < 800 && vehicle.y < 174;

      session.setControls({
        ...emptyControls(),
        throttle: !waiting && vehicle.speed < 4,
        brake: waiting,
        steer: vehicle.y <= 174 && vehicle.heading > -Math.PI + 0.03 ? -5.5 / 17.5 : 0,
      });
      session.step();

      if (session.getSnapshot().collision) {
        throw new Error('The learning event must be detected before contact');
      }

      if (yieldFirst && vehicle.x < 146) {
        break;
      }
    }
  }

  drive();

  const first = session.getSnapshot().current!;

  expect(first?.causes.map((reason) => reason.code)).toContain('priority-left-green');
  expect(first.causes.find((reason) => reason.rule === 'priority')!.facts.participantLabel).toBe(
    'М1',
  );

  const paused = session.getWorld();

  session.step();
  expect(session.getWorld()).toEqual(paused);
  session.retry();
  expect(session.getWorld()).toEqual(snapshots.get(session.getWorld().tick));
  drive();
  expect(session.getWorld()).toEqual(paused);
  expect(session.getSnapshot().current!.attemptId).not.toBe(first.attemptId);
  expect(session.getSnapshot().history.violations).toHaveLength(2);
  session.retry();
  drive(true);
  expect(session.getSnapshot().current).toBeNull();
  expect(session.getWorld().vehicle.x).toBeLessThan(146);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(saved.violations).toHaveLength(2);
});
