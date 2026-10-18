import { expect, it } from 'vitest';
import { GameSession } from '../../src/use-cases/session/game-session';
import { neighborhood } from '../../src/content/maps/neighborhood';
import { localContent } from '../../src/adapters/content/local';
import { emptyControls, emptyHistory } from '../../src/domain/world/model';
import { validateHistory } from '../../src/adapters/persistence/history-validation';

it('keeps one hour of simulated driving, repeated routes and saved incidents consistent', async () => {
  let saved = emptyHistory();

  let nextId = 0;

  const session = new GameSession(
    neighborhood,
    {
      load: async () => structuredClone(saved),
      save: async (history) => {
        saved = structuredClone(history);
      },
    },
    localContent,
    { id: () => String(++nextId), date: () => '2026-10-14T12:00:00Z' },
  );

  const waypoints = [
    [67.5, 50],
    [24, 50],
    [24, 84],
    [64, 84],
    [67.5, 70],
  ];

  let waypoint = 0;

  let laps = 0;

  await session.initialize();
  session.start();

  for (let tick = 0; tick < 60 * 60 * 60; tick++) {
    if (session.getSnapshot().current) {
      session.continueTrip();
    }

    const vehicle = session.getWorld().vehicle;

    const [x, y] = waypoints[waypoint];

    if (Math.hypot(x - vehicle.x, y - vehicle.y) < 4) {
      waypoint = (waypoint + 1) % waypoints.length;

      if (waypoint === 0) {
        laps++;
      }
    }

    const direction = Math.atan2(y - vehicle.y, x - vehicle.x) - vehicle.heading;

    const turn = Math.atan2(Math.sin(direction), Math.cos(direction));

    session.setControls({
      ...emptyControls(),
      throttle: vehicle.speed < 4.7,
      brake: vehicle.speed >= 4.7,
      steer: Math.abs(turn) > 0.065 ? Math.sign(turn) : 0,
    });
    session.step();

    if (tick % 3600 === 0) {
      await session.flushPersistence();
      session.pause('manual');

      const paused = session.getWorld();

      session.step();
      expect(session.getWorld()).toEqual(paused);
      session.resume();
    }
  }

  session.finish();
  await session.flushPersistence();
  expect(session.getWorld().tick).toBe(216000);
  expect(laps).toBeGreaterThan(20);
  expect(saved.violations.length).toBeGreaterThan(100);
  expect(validateHistory(saved)).toEqual(saved);
  expect(saved.trips).toHaveLength(1);
  expect(saved.trips[0].status).toBe('finished');
  console.info({ simulatedMinutes: 60, laps, violations: saved.violations.length });
}, 30000);
