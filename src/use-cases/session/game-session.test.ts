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
