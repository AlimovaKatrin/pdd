import { expect, it } from 'vitest';
import { GameSession } from '../../src/use-cases/session/game-session';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, emptyHistory, type History } from '../../src/domain/world/model';

it('pauses, persists and exactly replays the opposing-lane episode, then accepts correction', async () => {
  let saved: History = emptyHistory();

  let id = 0;

  const session = new GameSession(
    expandedCity,
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

  const start = session.getWorld();

  function driveAcross() {
    for (let tick = 0; tick < 300 && !session.getSnapshot().current; tick++) {
      session.setControls({ ...emptyControls(), throttle: true, steer: -1 });
      session.step();
    }
  }

  driveAcross();

  const first = session.getSnapshot().current!;

  const stopped = session.getWorld();

  expect(first.causes[0].code).toBe('oncoming-lane');
  expect(first.material).toBeNull();
  session.step();
  expect(session.getWorld()).toEqual(stopped);
  session.retry();
  expect(session.getWorld()).toEqual(start);
  expect(session.getSnapshot().history.violations).toHaveLength(1);
  driveAcross();
  expect(session.getWorld()).toEqual(stopped);
  expect(session.getSnapshot().current!.attemptId).not.toBe(first.attemptId);
  expect(session.getSnapshot().history.violations).toHaveLength(2);
  session.retry();

  for (let tick = 0; tick < 180; tick++) {
    session.setControls({ ...emptyControls(), throttle: true });
    session.step();
  }

  expect(session.getSnapshot().current).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(saved.violations).toHaveLength(2);
  expect(saved.violations[0].causes[0].facts.boundaryId).toBeTruthy();
  expect(saved.violations[0].causes[0].referenceCheckedOn).toBe('2026-10-18');
});
