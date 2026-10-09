import { expect, it } from 'vitest';
import { stopQuestion } from '../../src/content/questions/stop';
import { trafficQuestions } from '../../src/content/questions/traffic';
import {
  questionCoversCauses,
  selectQuestion,
  validateQuestion,
} from '../../src/domain/learning/question';
import type { AnswerAttempt } from '../../src/domain/world/model';

it('validates metadata and refuses unverified official or remote image content', () => {
  expect(validateQuestion(stopQuestion)).toBe(stopQuestion);

  for (const q of [
    null,
    {},
    { ...stopQuestion, status: 'verified' },
    { ...stopQuestion, correctIndex: 9 },
    { ...stopQuestion, context: 'related' },
    { ...stopQuestion, options: ['same', 'same'] },
    {
      ...stopQuestion,
      image: { src: 'https://remote/image.png', alt: 'x', source: 'x', usage: 'x' },
    },
  ]) {
    expect(() => validateQuestion(q)).toThrow();
  }
});
it('matches every cause and prefers unseen, then previously wrong materials', () => {
  const questions = ['a', 'b', 'c'].map((id) => ({ ...stopQuestion, id }));

  const answers: AnswerAttempt[] = [
    {
      id: '1',
      violationId: 'v',
      questionId: 'a',
      contentVersion: stopQuestion.version,
      answer: 0,
      correct: true,
      assisted: false,
      date: '2026-10-09',
    },
    {
      id: '2',
      violationId: 'v',
      questionId: 'b',
      contentVersion: stopQuestion.version,
      answer: 1,
      correct: false,
      assisted: false,
      date: '2026-10-09',
    },
  ];

  expect(selectQuestion(questions, 'stop', ['stop-line'], answers)?.id).toBe('c');
  expect(selectQuestion(questions.slice(0, 2), 'stop', ['stop-line'], answers)?.id).toBe('b');
  expect(
    selectQuestion(
      [...questions, ...trafficQuestions],
      'stop',
      ['stop-line', 'speed-limit'],
      answers,
    ),
  ).toBeUndefined();
  expect(
    selectQuestion(trafficQuestions, 'indicator', ['missing-indicator', 'early-indicator-off'])
      ?.context,
  ).toBe('related');
});

it('uses the same cause coverage for selection and pinned material, including legacy STOP', () => {
  expect(questionCoversCauses({}, ['stop-line'])).toBe(true);
  expect(questionCoversCauses({}, ['stop-line', 'speed-limit'])).toBe(false);
  expect(questionCoversCauses({ matches: [] }, ['stop-line'])).toBe(false);
  expect(
    questionCoversCauses({ matches: ['missing-indicator', 'late-indicator'] }, ['late-indicator']),
  ).toBe(true);
  expect(
    questionCoversCauses({ matches: ['missing-indicator'] }, [
      'missing-indicator',
      'late-indicator',
    ]),
  ).toBe(false);
});
