import { expect, it } from 'vitest';
import { GameSession } from '../../src/use-cases/session/game-session';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { localContent } from '../../src/adapters/content/local';
import { emptyHistory } from '../../src/domain/world/model';

it('includes every car and random state in immutable snapshots and the common pause', async () => {
  let id = 0;

  const session = new GameSession(
    expandedCity,
    {
      load: async () => emptyHistory(),
      save: async () => {},
    },
    localContent,
    { id: () => String(++id), date: () => '2026-10-18T12:00:00Z' },
  );

  await session.initialize();
  session.start();

  for (let tick = 0; tick < 180; tick++) {
    session.step();
  }

  const snapshot = session.getWorld();

  expect(snapshot.traffic.vehicles.length).toBeGreaterThan(0);
  expect(Object.isFrozen(snapshot.traffic.vehicles[0].vehicle)).toBe(true);
  session.pause('manual');

  for (let tick = 0; tick < 120; tick++) {
    session.step();
  }

  expect(session.getWorld()).toEqual(snapshot);
  session.pause('blur');
  session.openJournal();
  session.closeJournal();
  session.step();
  expect(session.getWorld()).toEqual(snapshot);
  session.resume();
  session.step();
  expect(session.getWorld().traffic).not.toEqual(snapshot.traffic);
  expect(session.getSnapshot().history.violations).toEqual([]);
});
