import { cause } from '../../src/domain/violations/causes';
import { expect, it } from 'vitest';
import { GameSession } from '../../src/use-cases/session/game-session';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { emptyControls, emptyHistory, type History } from '../../src/domain/world/model';
import { localContent } from '../../src/adapters/content/local';
import { vehiclesOverlap } from '../../src/domain/world/vehicle-geometry';

it('pauses contact once, refuses retry and preserves the trip, traffic and history on safe return', async () => {
  let id = 0;

  const map = { ...expandedCity, spawn: { x: 162, y: 43.5, heading: Math.PI } };

  const session = new GameSession(
    map,
    {
      load: async (): Promise<History> => ({
        ...emptyHistory(),
        trips: [{ id: 'past-trip', startedAt: '2026-10-17T10:00:00Z', status: 'finished' }],
        violations: [
          {
            id: 'past-stop',
            tripId: 'past-trip',
            attemptId: 'past-attempt',
            date: '2026-10-17T10:00:00Z',
            type: 'stop',
            roadObjectId: 'past-line',
            episode: 1,
            speed: 3,
            tick: 60,
            mapVersion: 'neighborhood-3',
            rulesVersion: 'mvp-preview-5',
            causes: [cause('stop-line', { speedKmh: 10.8 })],
            material: null,
          },
        ],
      }),
      save: async () => {},
    },
    localContent,
    { id: () => String(++id), date: () => '2026-10-18T12:00:00Z' },
  );

  await session.initialize();
  session.start();

  for (let tick = 0; tick < 600 && !session.getSnapshot().collision; tick++) {
    if (session.getSnapshot().current) {
      session.continueTrip();
    }

    session.setControls({ ...emptyControls(), throttle: true });
    session.step();
  }

  const contact = session.getSnapshot().collision!;

  const paused = session.getWorld();

  const history = session.getSnapshot().history;

  const tripId = session.getSnapshot().activeTripId;

  expect(contact.participantLabel).toBe('М1');
  expect(contact.player.speed).toBeGreaterThan(0);
  expect(history.violations.length).toBeGreaterThan(0);
  expect(session.isRunning()).toBe(false);
  expect(
    paused.traffic.vehicles.every((car) => !vehiclesOverlap(paused.vehicle, car.vehicle)),
  ).toBe(true);
  session.retry();
  session.continueTrip();
  session.resume();

  for (let tick = 0; tick < 60; tick++) {
    session.setControls({ ...emptyControls(), throttle: true });
    session.step();
  }

  expect(session.getWorld()).toEqual(paused);
  expect(session.getSnapshot().collision).toEqual(contact);
  expect(session.getSnapshot().history).toEqual(history);
  session.pause('manual');
  session.pause('blur');
  session.returnToRoad();

  const returned = session.getWorld();

  expect(session.getSnapshot().collision).toBeNull();
  expect(session.getSnapshot().activeTripId).toBe(tripId);
  expect(session.getSnapshot().history.violations).toEqual(history.violations);
  expect(session.getSnapshot().pauses).toEqual(['manual', 'blur']);
  expect(returned.traffic).toEqual(paused.traffic);
  expect(returned.pedestrians).toEqual(paused.pedestrians);
  expect(returned.tick).toBe(paused.tick);
  expect(returned.vehicle.speed).toBe(0);
  expect(returned.relocation).toBe(paused.relocation + 1);
  session.resume();

  for (let tick = 0; tick < 120; tick++) {
    session.step();
  }

  expect(session.getSnapshot().collision).toBeNull();
  expect(session.getSnapshot().current).toBeNull();
  expect(session.getWorld().vehicle).toEqual(returned.vehicle);
  expect(session.getSnapshot().history.violations).toEqual(history.violations);
});
