import { expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { GameSession } from '../../src/use-cases/session/game-session';
import { emptyControls, emptyHistory } from '../../src/domain/world/model';

it('loads the expanded map through the real session, freezes its data and preserves pause/retry', async () => {
  let counter = 0;

  const session = new GameSession(
    expandedCity,
    {
      load: async () => emptyHistory(),
      save: async () => {},
    },
    { getCandidates: async () => [] },
    {
      id: () => `city-test-${counter++}`,
      date: () => '2026-10-18T12:00:00Z',
    },
  );

  await session.initialize();
  session.start();
  expect(session.map.network?.connections).toHaveLength(108);
  expect(Object.isFrozen(session.map.network?.lanes[0].from)).toBe(true);
  session.setControls({ ...emptyControls(), throttle: true });

  for (let index = 0; index < 120; index++) {
    session.step();
  }

  expect(session.getWorld().vehicle.y).toBeLessThan(expandedCity.spawn.y);
  session.pause('manual');

  const paused = session.getWorld();

  session.step();
  expect(session.getWorld()).toEqual(paused);
  session.returnToRoad();
  expect(session.getSnapshot().pauses).toContain('manual');
  expect(session.getWorld().vehicle.speed).toBe(0);
});
