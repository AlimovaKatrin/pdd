import 'fake-indexeddb/auto';
import { cause } from '../../src/domain/violations/causes';
import { expect, it } from 'vitest';
import { IndexedDbHistory } from '../../src/adapters/persistence/indexed-db';
import { validateHistory } from '../../src/adapters/persistence/history-validation';
import { emptyHistory, type History } from '../../src/domain/world/model';

it('round-trips history and replaces the snapshot without duplicates', async () => {
  const repository = new IndexedDbHistory('test-history');

  expect(await repository.load()).toEqual(emptyHistory());

  const history: History = {
    ...emptyHistory(),
    trips: [{ id: 'trip', startedAt: '2026-10-09', status: 'finished' }],
    violations: [
      {
        id: 'v',
        causes: [cause('stop-line', {})],
        material: null,
        tripId: 'trip',
        attemptId: 'try',
        date: '2026-10-09',
        type: 'stop',
        speed: 3,
        tick: 2,
        episode: 1,
        roadObjectId: 'stop',
        mapVersion: '1',
        rulesVersion: '1',
      },
    ],
  };

  await repository.save(history);
  await repository.save(history);
  expect(await repository.load()).toEqual(history);
  await repository.save(emptyHistory());
  expect(await repository.load()).toEqual(emptyHistory());
});
it('rejects unknown schema, broken records and dangling answers', () => {
  expect(() => validateHistory({ ...emptyHistory(), schemaVersion: 99 })).toThrow();
  expect(() => validateHistory({ ...emptyHistory(), violations: [{}] })).toThrow();
  expect(() => validateHistory({ ...emptyHistory(), revealed: ['missing'] })).toThrow();
});
it('migrates v1 without changing answers, assistance or the unanswered demo material', async () => {
  const record = {
    id: 'old',
    tripId: 't',
    attemptId: 'a',
    date: '2026-10-08',
    type: 'stop',
    speed: 4,
    tick: 12,
    episode: 1,
    roadObjectId: 'old-stop',
    mapVersion: 'neighborhood-1',
    rulesVersion: 'stop-1',
  };

  const answer = {
    id: 'answer',
    violationId: 'old',
    questionId: 'demo-stop-line',
    contentVersion: 'demo-1',
    answer: 1,
    correct: false,
    assisted: true,
    date: '2026-10-08',
  };

  const migrated = validateHistory({
    schemaVersion: 1,
    violations: [record, { ...record, id: 'unanswered' }],
    answers: [answer],
    revealed: ['old'],
  });

  expect(migrated.schemaVersion).toBe(2);
  expect(
    migrated.violations.every((entry) => entry.causes[0].referenceCheckedOn === undefined),
  ).toBe(true);
  expect(migrated.answers).toEqual([answer]);
  expect(migrated.revealed).toEqual(['old']);
  expect(
    migrated.violations.every(
      (v) =>
        v.material?.version === 'demo-1' &&
        v.material.reference.verification.includes('ещё не сверена'),
    ),
  ).toBe(true);
  expect(migrated.trips[0].status).toBe('legacy');

  const repository = new IndexedDbHistory('migration');

  await repository.save(migrated);
  expect(await repository.load()).toEqual(migrated);

  const unknown = validateHistory({
    schemaVersion: 1,
    violations: [record],
    answers: [{ ...answer, contentVersion: 'missing' }],
    revealed: [],
  });

  expect(unknown.violations[0].material).toBeNull();
  expect(unknown.violations[0].materialUnavailable).toBeTruthy();
});
