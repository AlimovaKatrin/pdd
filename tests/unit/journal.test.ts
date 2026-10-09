import { expect, it } from 'vitest';
import { emptyHistory, type History, type Violation } from '../../src/domain/world/model';
import { cause } from '../../src/domain/violations/causes';
import { createJournalView, type JournalFilters } from '../../src/presentation/view-models/journal';
import { incidentTimeline } from '../../src/presentation/view-models/incident';

function historyWithAttempts(): History {
  const violation: Violation = {
    id: 'first',
    tripId: 'trip',
    attemptId: 'attempt',
    date: '2026-10-09',
    type: 'stop',
    speed: 4,
    tick: 10,
    episode: 1,
    roadObjectId: 'stop',
    mapVersion: 'map',
    rulesVersion: 'rules',
    material: null,
    causes: [cause('stop-line', {}), cause('speed-limit', {})],
  };

  const answer = {
    id: 'wrong',
    violationId: 'first',
    questionId: 'question',
    contentVersion: '1',
    date: '2026-10-09T12:00:00Z',
    answer: 1,
    correct: false,
    assisted: false,
  };

  return {
    ...emptyHistory(),
    trips: ['trip', 'other', 'clean'].map((id) => ({
      id,
      startedAt: '2026-10-09',
      status: 'finished',
    })),
    violations: [
      violation,
      { ...violation, id: 'second', type: 'speed', causes: [cause('speed-limit', {})] },
      { ...violation, id: 'third', tripId: 'other', causes: [cause('stop-line', {})] },
    ],
    answers: [
      answer,
      {
        ...answer,
        id: 'correct',
        answer: 0,
        correct: true,
        assisted: true,
        date: '2026-10-09T12:02:00Z',
      },
      { ...answer, id: 'independent', violationId: 'third', answer: 0, correct: true },
    ],
    revealed: ['first', 'second'],
    skips: [
      { id: 'skip', violationId: 'second', date: '2026-10-09T12:01:00Z' },
      { id: 'earlier-skip', violationId: 'first', date: '2026-10-09T11:59:00Z' },
    ],
  };
}

it.each<[JournalFilters['result'], string[]]>([
  ['all', ['third', 'second', 'first']],
  ['wrong', ['first']],
  ['correct', ['third', 'first']],
  ['unanswered', ['second']],
  ['assisted', ['second', 'first']],
  ['skipped', ['second', 'first']],
])('filters %s by all attempts while keeping newest incidents first', (result, ids) => {
  const history = historyWithAttempts();

  const before = structuredClone(history);

  const view = createJournalView(history, { trip: 'all', rule: 'all', result }, null);

  expect(view.entries.map((entry) => entry.violation.id)).toEqual(ids);
  expect(history).toEqual(before);
});

it('combines trip, cause and answer filters without losing earlier failed attempts', () => {
  const view = createJournalView(
    historyWithAttempts(),
    { trip: 'trip', rule: 'speed', result: 'correct' },
    'trip',
  );

  expect(view.entries.map((entry) => entry.violation.id)).toEqual(['first']);
  expect(view.entries[0]).toMatchObject({
    answerCount: 2,
    hasWrongAnswer: true,
    hasCorrectAnswer: true,
    skipped: true,
  });
  expect(view.completedSummary).toEqual({ violations: 2, answers: 2, independentCorrect: 0 });
  expect(view.isChosenTripClean).toBe(false);
});

it('distinguishes an empty filter from a clean completed trip and counts independent answers', () => {
  const history = historyWithAttempts();

  const clean = createJournalView(history, { trip: 'clean', rule: 'all', result: 'all' }, 'clean');

  const filtered = createJournalView(
    history,
    { trip: 'other', rule: 'all', result: 'wrong' },
    'other',
  );

  expect(clean.entries).toEqual([]);
  expect(clean.isChosenTripClean).toBe(true);
  expect(clean.completedSummary).toEqual({ violations: 0, answers: 0, independentCorrect: 0 });
  expect(filtered.entries).toEqual([]);
  expect(filtered.isChosenTripClean).toBe(false);
  expect(filtered.completedSummary).toEqual({ violations: 1, answers: 1, independentCorrect: 1 });
});

it('orders skips and answers chronologically for the selected incident', () => {
  const timeline = incidentTimeline(historyWithAttempts(), 'first');

  expect(timeline.map((item) => item.label)).toEqual([
    'Пропуск: продолжение без ответа',
    'Ответ 2: ошибка · самостоятельно',
    'Ответ 1: верно · с помощью',
  ]);
});
