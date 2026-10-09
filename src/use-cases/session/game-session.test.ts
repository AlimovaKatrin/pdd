import { beforeEach, describe, expect, it } from 'vitest';
import { GameSession } from './game-session';
import { neighborhood } from '../../content/maps/neighborhood';
import { localContent } from '../../adapters/content/local';
import { emptyControls, emptyHistory, type History } from '../../domain/world/model';
import type { HistoryRepository } from '../ports';
let counter = 0;
class MemoryHistory implements HistoryRepository {
  history: History = emptyHistory();
  fail = false;
  async load() {
    return structuredClone(this.history);
  }
  async save(history: History) {
    if (this.fail) {
      throw new Error('quota');
    }
    this.history = structuredClone(history);
  }
}
function create(repository: HistoryRepository = new MemoryHistory()) {
  return new GameSession(neighborhood, repository, localContent, {
    id: () => String(++counter),
    date: () => '2026-10-09T12:00:00Z',
  });
}
function driveToViolation(s: GameSession) {
  s.setControls({ ...emptyControls(), throttle: true });
  for (let i = 0; i < 600 && !s.getSnapshot().current; i++) {
    s.step();
  }
  expect(s.getSnapshot().current).not.toBeNull();
}
beforeEach(() => {
  counter = 0;
});
describe('game session', () => {
  it('publishes completed maneuvers, preserves them on safe return and clears them for a new trip', async () => {
    const s = create();
    await s.initialize();
    s.start();
    s.setControls({ ...emptyControls(), throttle: true });
    for (let i = 0; i < 138; i++) {
      s.step();
    }
    s.setControls({ ...emptyControls(), brake: true });
    while (s.getWorld().vehicle.speed > 0) {
      s.step();
    }
    s.setControls({ ...emptyControls(), throttle: true });
    for (let i = 0; i < 120; i++) {
      s.step();
    }
    expect(s.getSnapshot().world.successfulManeuvers).toBe(1);
    s.pause('manual');
    for (let i = 0; i < 60; i++) {
      s.step();
    }
    expect(s.getSnapshot().world.successfulManeuvers).toBe(1);
    s.returnToRoad();
    expect(s.getSnapshot().world.successfulManeuvers).toBe(1);
    s.start();
    expect(s.getSnapshot().world.successfulManeuvers).toBe(0);
  });
  it('records an incident, pauses, continues without answering and does not duplicate', async () => {
    const repository = new MemoryHistory(),
      s = create(repository);
    await s.initialize();
    s.start();
    driveToViolation(s);
    const tick = s.getWorld().tick;
    s.step();
    expect(s.getWorld().tick).toBe(tick);
    s.continueTrip();
    for (let i = 0; i < 30; i++) {
      s.step();
    }
    await s.flushPersistence();
    expect(s.getSnapshot().history.violations).toHaveLength(1);
    expect(s.getSnapshot().history.answers).toHaveLength(0);
    expect(repository.history.violations).toHaveLength(1);
  });
  it('restores the world and rule states while keeping immutable history', async () => {
    const s = create();
    await s.initialize();
    s.start();
    driveToViolation(s);
    const id = s.getSnapshot().current!.id;
    s.answerQuestion(0);
    s.retry();
    expect(s.getWorld().tick).toBe(0);
    expect(s.getSnapshot().history.answers).toHaveLength(1);
    driveToViolation(s);
    expect(s.getSnapshot().history.violations).toHaveLength(2);
    expect(s.getSnapshot().current!.id).not.toBe(id);
    expect(s.getSnapshot().history.violations[0].attemptId).not.toBe(
      s.getSnapshot().current!.attemptId,
    );
  });
  it('retains other pause reasons when the card closes and clears held input', async () => {
    const s = create();
    await s.initialize();
    s.start();
    driveToViolation(s);
    s.pause('blur');
    s.continueTrip();
    expect(s.isRunning()).toBe(false);
    s.resume();
    const speed = s.getWorld().vehicle.speed;
    s.step();
    expect(s.getWorld().vehicle.speed).toBeLessThan(speed);
  });
  it('persists assistance, keeps attempts and never cancels the violation', async () => {
    const repository = new MemoryHistory(),
      s = create(repository);
    await s.initialize();
    s.start();
    driveToViolation(s);
    s.reveal();
    s.answerQuestion(1);
    s.answerQuestion(0); // double click must not duplicate
    const violationId = s.getSnapshot().current!.id;
    s.continueTrip();
    s.review(violationId);
    s.answerQuestion(0);
    await s.flushPersistence();
    expect(repository.history.answers).toHaveLength(2);
    expect(repository.history.answers.every((a) => a.assisted)).toBe(true);
    const next = create(repository);
    await next.initialize();
    next.review(violationId);
    expect(next.getSnapshot().revealed).toBe(true);
    expect(next.canRetry(violationId)).toBe(false);
    expect(next.getSnapshot().history.violations).toHaveLength(1);
  });
  it('keeps driving if saving fails', async () => {
    const repository = new MemoryHistory();
    repository.fail = true;
    const s = create(repository);
    await s.initialize();
    s.start();
    driveToViolation(s);
    await s.flushPersistence();
    expect(s.getSnapshot().storage).toBe('error');
    s.continueTrip();
    expect(s.isRunning()).toBe(true);
  });
  it('does not overwrite unreadable historical data', async () => {
    let saves = 0;
    const s = create({
      load: async () => {
        throw new Error('corrupt');
      },
      save: async () => {
        saves++;
      },
    });
    await s.initialize();
    s.start();
    driveToViolation(s);
    await s.flushPersistence();
    expect(saves).toBe(0);
    expect(s.getSnapshot().history.violations).toHaveLength(1);
  });
  it('does not interpret safe relocation as crossing the line', async () => {
    const s = create();
    await s.initialize();
    s.start();
    driveToViolation(s);
    s.returnToRoad();
    s.step();
    expect(s.getSnapshot().current).toBeNull();
    expect(s.getSnapshot().history.violations).toHaveLength(1);
  });
});
it('keeps saving status until all queued snapshots are persisted', async () => {
  const releases: Array<() => void> = [];
  const s = create({
    load: async () => emptyHistory(),
    save: () => new Promise<void>((resolve) => releases.push(resolve)),
  });
  await s.initialize();
  s.start();
  driveToViolation(s);
  s.reveal();
  while (!releases.length) {
    await Promise.resolve();
  }
  releases.shift()!();
  while (!releases.length) {
    await Promise.resolve();
  }
  expect(s.getSnapshot().storage).toBe('saving');
  releases.shift()!();
  while (!releases.length) {
    await Promise.resolve();
  }
  expect(s.getSnapshot().storage).toBe('saving');
  releases.shift()!();
  await s.flushPersistence();
  expect(s.getSnapshot().storage).toBe('saved');
});
it('allows the incident loop when the content provider fails', async () => {
  const s = new GameSession(
    neighborhood,
    new MemoryHistory(),
    {
      getCandidates: async () => {
        throw new Error('unavailable');
      },
    },
    { id: () => String(++counter), date: () => '2026-10-09' },
  );
  await s.initialize();
  s.start();
  driveToViolation(s);
  expect(s.getSnapshot().question).toBeUndefined();
  s.continueTrip();
  expect(s.isRunning()).toBe(true);
});
it('pins even an unanswered question and keeps a skip after a subsequent answer', async () => {
  const repository = new MemoryHistory(),
    s = create(repository);
  await s.initialize();
  s.start();
  driveToViolation(s);
  const original = structuredClone(s.getSnapshot().question);
  const id = s.getSnapshot().current!.id;
  s.continueTrip();
  await s.flushPersistence();
  const newer = new GameSession(
    neighborhood,
    repository,
    { getCandidates: async () => [] },
    { id: () => String(++counter), date: () => '2026-10-09' },
  );
  await newer.initialize();
  newer.openJournal();
  newer.review(id);
  expect(newer.getSnapshot().question).toEqual(original);
  expect(newer.isRunning()).toBe(false);
  newer.answerQuestion(0);
  newer.continueTrip();
  await newer.flushPersistence();
  expect(repository.history.skips).toHaveLength(1);
  expect(repository.history.answers).toHaveLength(1);
  expect(newer.getSnapshot().journal).toBe(true);
  expect(newer.getSnapshot().started).toBe(false);
});
it('persists clean trips, restart/finish results and interrupted trips', async () => {
  const repository = new MemoryHistory(),
    s = create(repository);
  await s.initialize();
  s.start();
  s.start();
  s.finish();
  await s.flushPersistence();
  expect(repository.history.violations).toEqual([]);
  expect(repository.history.trips.map((t) => t.status)).toEqual(['restarted', 'finished']);
  expect(s.getSnapshot().completedTripId).toBe(repository.history.trips[1].id);
  s.start();
  await s.flushPersistence();
  const next = create(repository);
  await next.initialize();
  expect(next.getSnapshot().history.trips.at(-1)?.status).toBe('interrupted');
});
it('groups simultaneous rules, keeps all causes and allows fallback without a misleading question', async () => {
  const custom = {
    ...neighborhood,
    speedZones: [
      {
        ...neighborhood.speedZones![0],
        x: 64,
        y: 50,
        width: 7,
        height: 9,
        limit: 1,
        direction: { x: 0, y: -1 },
        sign: { x: 71, y: 59 },
        end: { x: 71, y: 50 },
      },
    ],
  };
  const s = new GameSession(custom, new MemoryHistory(), localContent, {
    id: () => String(++counter),
    date: () => '2026-10-09',
  });
  await s.initialize();
  s.start();
  driveToViolation(s);
  expect(s.getSnapshot().current!.causes.map((c) => c.rule)).toEqual(['stop', 'speed']);
  expect(s.getSnapshot().question).toBeUndefined();
  expect(s.getSnapshot().history.violations).toHaveLength(1);
  const before = structuredClone(s.getWorld());
  s.step();
  expect(s.getWorld()).toEqual(before);
  s.continueTrip();
  for (let i = 0; i < 30; i++) {
    s.step();
  }
  expect(s.getSnapshot().history.violations).toHaveLength(1);
});
it('restores all world actors and does not mutate prior snapshots', async () => {
  const s = create();
  await s.initialize();
  s.start();
  const initial = structuredClone(s.getWorld());
  driveToViolation(s);
  const frozen = structuredClone(s.getWorld());
  s.pause('manual');
  s.step();
  expect(s.getWorld()).toEqual(frozen);
  s.retry();
  expect(s.getWorld()).toEqual(initial);
  expect(s.isRunning()).toBe(false);
  s.resume();
  driveToViolation(s);
  expect(s.getWorld()).toEqual(frozen);
});
it('keeps the active trip record when clearing history during a trip', async () => {
  const s = create();
  await s.initialize();
  s.start();
  driveToViolation(s);
  s.clearHistory();
  expect(s.getSnapshot().history.trips).toHaveLength(1);
  expect(s.getSnapshot().history.violations).toHaveLength(0);
  expect(s.isRunning()).toBe(true);
});
it('appends later indicator causes to the same maneuver incident', async () => {
  const custom = { ...neighborhood, stops: [], spawn: { x: 67.5, y: 55, heading: -Math.PI / 2 } };
  const s = new GameSession(custom, new MemoryHistory(), localContent, {
    id: () => String(++counter),
    date: () => '2026-10-09',
  });
  await s.initialize();
  s.start();
  s.setControls({ ...emptyControls(), throttle: true, steer: -1 });
  for (let i = 0; i < 300 && !s.getSnapshot().current; i++) {
    s.step();
  }
  expect(s.getSnapshot().current?.causes[0].code).toBe('missing-indicator');
  const id = s.getSnapshot().current!.id,
    material = structuredClone(s.getSnapshot().current!.material);
  s.continueTrip();
  s.toggleIndicator('left');
  s.step();
  expect(s.getSnapshot().current?.id).toBe(id);
  expect(s.getSnapshot().current?.causes.map((c) => c.code)).toContain('late-indicator');
  s.continueTrip();
  s.toggleIndicator('left');
  s.step();
  expect(s.getSnapshot().current?.causes.map((c) => c.code)).toContain('early-indicator-off');
  expect(s.getSnapshot().history.violations).toHaveLength(1);
  expect(s.getSnapshot().current!.material).toEqual(material);
});
it.each(['speed', 'signal', 'pedestrian'] as const)(
  'runs the complete %s incident path with its own material',
  async (rule) => {
    const spawn =
      rule === 'speed'
        ? { x: 40, y: 21, heading: 0 }
        : rule === 'signal'
          ? { x: 107.5, y: 72, heading: -Math.PI / 2 }
          : { x: 20.5, y: 61, heading: Math.PI / 2 };
    const custom = {
      ...neighborhood,
      spawn,
      stops: [],
      signals: neighborhood.signals!.map((s) => ({ ...s, offset: 800 })),
    };
    const repository = new MemoryHistory(),
      s = new GameSession(custom, repository, localContent, {
        id: () => String(++counter),
        date: () => '2026-10-09',
      });
    await s.initialize();
    s.start();
    driveToViolation(s);
    expect(s.getSnapshot().current?.type).toBe(rule);
    expect(s.getSnapshot().question?.rule).toBe(rule);
    s.answerQuestion(0);
    s.continueTrip();
    await s.flushPersistence();
    expect(repository.history.answers[0].correct).toBe(true);
    expect(repository.history.violations).toHaveLength(1);
  },
);
