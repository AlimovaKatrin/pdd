import { expect, it } from 'vitest';
import { validateHistory } from '../../src/adapters/persistence/history-validation';
import { stopQuestion } from '../../src/content/questions/stop';
import { emptyHistory, type History } from '../../src/domain/world/model';
import { cause } from '../../src/domain/violations/causes';

function savedHistory(): History {
  return {
    ...emptyHistory(),
    trips: [{ id: 'trip', startedAt: '2026-10-09', status: 'finished' }],
    violations: [
      {
        id: 'incident',
        tripId: 'trip',
        attemptId: 'attempt',
        date: '2026-10-09',
        type: 'stop',
        roadObjectId: 'stop',
        speed: 3,
        tick: 10,
        episode: 1,
        mapVersion: 'map',
        rulesVersion: 'rules',
        causes: [cause('stop-line', {})],
        material: structuredClone(stopQuestion),
      },
    ],
    answers: [
      {
        id: 'answer',
        violationId: 'incident',
        questionId: stopQuestion.id,
        contentVersion: stopQuestion.version,
        date: '2026-10-09',
        answer: stopQuestion.correctIndex,
        correct: true,
        assisted: false,
      },
    ],
    revealed: ['incident'],
    skips: [{ id: 'skip', violationId: 'incident', date: '2026-10-09' }],
  };
}

it('validates a pinned answer without changing saved history', () => {
  const history = savedHistory();

  const before = structuredClone(history);

  expect(validateHistory(history)).toEqual(before);
  expect(history).toEqual(before);
});

it.each<[string, (history: History) => void]>([
  ['duplicate trips', (history) => history.trips.push(history.trips[0])],
  ['duplicate incidents', (history) => history.violations.push(history.violations[0])],
  ['duplicate answers', (history) => history.answers.push(history.answers[0])],
  ['duplicate skips', (history) => history.skips.push(history.skips[0])],
  [
    'missing trip',
    (history) => {
      history.violations[0].tripId = 'missing';
    },
  ],
  [
    'missing incident',
    (history) => {
      history.answers[0].violationId = 'missing';
    },
  ],
  ['dangling reveal', (history) => history.revealed.push('missing')],
  [
    'dangling skip',
    (history) => {
      history.skips[0].violationId = 'missing';
    },
  ],
  [
    'wrong material version',
    (history) => {
      history.answers[0].contentVersion = 'missing';
    },
  ],
  [
    'wrong answer result',
    (history) => {
      history.answers[0].correct = false;
    },
  ],
  [
    'negative answer',
    (history) => {
      history.answers[0].answer = -1;
    },
  ],
  [
    'answer outside options',
    (history) => {
      history.answers[0].answer = stopQuestion.options.length;
    },
  ],
])('rejects %s', (_name, corrupt) => {
  const history = savedHistory();

  corrupt(history);
  expect(() => validateHistory(history)).toThrow();
});
