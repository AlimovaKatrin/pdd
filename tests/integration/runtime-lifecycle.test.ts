import { afterEach, expect, it, vi } from 'vitest';
import { startRuntime } from '../../src/adapters/runtime/loop';
import { GameSession } from '../../src/use-cases/session/game-session';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { localContent } from '../../src/adapters/content/local';
import { emptyControls, emptyHistory } from '../../src/domain/world/model';

afterEach(() => vi.unstubAllGlobals());

it('bounds catch-up, clears input on blur and releases runtime callbacks and listeners', async () => {
  const callbacks = new Map<number, FrameRequestCallback>();

  let nextFrame = 0;

  const browserWindow = new EventTarget();

  const browserDocument = Object.assign(new EventTarget(), { hidden: false });

  vi.stubGlobal('window', browserWindow);
  vi.stubGlobal('document', browserDocument);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++nextFrame, callback);

    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));

  const session = new GameSession(
    expandedCity,
    { load: async () => emptyHistory(), save: async () => {} },
    localContent,
    { id: () => 'runtime-trip', date: () => '2026-10-18T12:00:00Z' },
  );

  await session.initialize();
  session.start();

  const dispose = startRuntime(session);

  function frame(time: number) {
    const pending = [...callbacks.values()];

    callbacks.clear();
    pending.forEach((callback) => callback(time));
  }

  session.setControls({ ...emptyControls(), throttle: true });
  frame(100);
  frame(1100);
  expect(session.getWorld().tick).toBeGreaterThan(0);
  expect(session.getWorld().tick).toBeLessThanOrEqual(6);
  expect(session.getWorld().vehicle.speed).toBeGreaterThan(0);
  browserWindow.dispatchEvent(new Event('blur'));

  const paused = session.getWorld();

  frame(100000);
  expect(session.getWorld()).toEqual(paused);
  session.resume();
  frame(100017);
  expect(session.getWorld().tick - paused.tick).toBeLessThanOrEqual(2);
  expect(session.getWorld().vehicle.speed).toBeLessThanOrEqual(paused.vehicle.speed);

  browserDocument.hidden = true;
  browserDocument.dispatchEvent(new Event('visibilitychange'));
  expect(session.isRunning()).toBe(false);
  dispose();
  expect(callbacks.size).toBe(0);
  session.resume();

  const afterDispose = session.getWorld();

  browserWindow.dispatchEvent(new Event('blur'));
  browserDocument.dispatchEvent(new Event('visibilitychange'));
  frame(200000);
  expect(session.isRunning()).toBe(true);
  expect(session.getWorld()).toEqual(afterDispose);
});
