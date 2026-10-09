import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { IndexedDbHistory, validateHistory } from './indexed-db';
import { emptyHistory, type History } from '../../domain/world/model';
it('round-trips history and replaces the snapshot without duplicates', async () => {
  const repository = new IndexedDbHistory('test-history');
  expect(await repository.load()).toEqual(emptyHistory());
  const history: History = {
    ...emptyHistory(),
    violations: [
      {
        id: 'v',
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
  expect(() => validateHistory({ ...emptyHistory(), schemaVersion: 2 })).toThrow();
  expect(() => validateHistory({ ...emptyHistory(), violations: [{}] })).toThrow();
  expect(() => validateHistory({ ...emptyHistory(), revealed: ['missing'] })).toThrow();
});
