import { expect, it } from 'vitest';
import { GameSession } from '../../src/use-cases/session/game-session';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, emptyHistory, type History } from '../../src/domain/world/model';

it('expires old checkpoints without losing their history and keeps independent pauses during retry', async () => {
  let saved: History = emptyHistory();

  let id = 0;

  const repository = {
    load: async () => saved,
    save: async (value: History) => {
      saved = structuredClone(value);
    },
  };

  const environment = { id: () => String(++id), date: () => '2026-10-18T12:00:00Z' };

  const session = new GameSession(
    expandedCity,
    repository,
    { getCandidates: async () => [] },
    environment,
  );

  await session.initialize();
  session.start();

  const incidentIds: string[] = [];

  for (let episode = 0; episode < 24; episode++) {
    session.setControls({ ...emptyControls(), throttle: true, steer: -1 });

    for (let step = 0; step < 600 && !session.getSnapshot().current; step++) {
      session.step();
      expect(session.getSnapshot().collision).toBeNull();
    }

    const current = session.getSnapshot().current;

    expect(current).not.toBeNull();
    incidentIds.push(current!.id);
    expect(session.canRetry(current!.id)).toBe(true);

    const paused = session.getWorld();

    for (let step = 0; step < 120; step++) {
      session.step();
    }

    expect(session.getWorld()).toEqual(paused);
    session.returnToRoad();
  }

  expect(session.getSnapshot().history.violations).toHaveLength(24);
  expect(incidentIds.filter((key) => session.canRetry(key))).toHaveLength(20);
  expect(session.canRetry(incidentIds[0])).toBe(false);
  session.review(incidentIds[0]);

  const before = session.getWorld();

  session.retry();
  expect(session.getWorld()).toEqual(before);
  session.continueTrip();
  session.review(incidentIds.at(-1)!);
  session.pause('manual');
  session.pause('blur');
  session.retry();

  const restored = session.getWorld();

  session.step();
  expect(session.getWorld()).toEqual(restored);
  expect(session.getSnapshot().pauses).toEqual(expect.arrayContaining(['manual', 'blur']));
  expect(session.getSnapshot().history.violations).toHaveLength(24);
  session.resume();
  session.step();
  expect(session.getWorld().vehicle.speed).toBeLessThanOrEqual(restored.vehicle.speed);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const reopened = new GameSession(
    expandedCity,
    repository,
    { getCandidates: async () => [] },
    environment,
  );

  await reopened.initialize();
  expect(reopened.getSnapshot().history.violations).toHaveLength(24);
  expect(reopened.canRetry(incidentIds.at(-1)!)).toBe(false);
});
