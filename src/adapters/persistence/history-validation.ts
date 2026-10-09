import type { AnswerAttempt, History, Violation } from '../../domain/world/model';
import { migrateHistory } from './history-migration';
import {
  isAnswer,
  isObject,
  isSkip,
  isTrip,
  isViolation,
  requireUniqueIds,
} from './history-records';

function validateAnswerMaterials(answers: AnswerAttempt[], violations: Violation[]) {
  for (const answer of answers) {
    const question = violations.find((violation) => violation.id === answer.violationId)?.material;

    if (
      question &&
      (answer.questionId !== question.id ||
        answer.contentVersion !== question.version ||
        answer.answer >= question.options.length ||
        answer.correct !== (answer.answer === question.correctIndex))
    ) {
      throw new Error('Answer does not match its pinned material');
    }
  }
}

export function validateHistory(value: unknown): History {
  if (!isObject(value)) {
    throw new Error('Invalid history');
  }

  if (value.schemaVersion === 1) {
    return validateHistory(migrateHistory(value));
  }

  if (
    value.schemaVersion !== 2 ||
    !Array.isArray(value.violations) ||
    !Array.isArray(value.answers) ||
    !Array.isArray(value.trips) ||
    !Array.isArray(value.skips) ||
    !Array.isArray(value.revealed)
  ) {
    throw new Error('Unsupported history');
  }

  const violations: unknown[] = value.violations;

  const answers: unknown[] = value.answers;

  const trips: unknown[] = value.trips;

  const skips: unknown[] = value.skips;

  const revealed: unknown[] = value.revealed;

  if (
    !violations.every(isViolation) ||
    !answers.every(isAnswer) ||
    !trips.every(isTrip) ||
    !skips.every(isSkip) ||
    !revealed.every((id): id is string => typeof id === 'string')
  ) {
    throw new Error('Invalid history records');
  }

  for (const records of [violations, answers, trips, skips]) {
    requireUniqueIds(records);
  }

  const tripIds = new Set(trips.map((trip) => trip.id));

  const violationIds = new Set(violations.map((violation) => violation.id));

  if (
    !violations.every((violation) => tripIds.has(violation.tripId)) ||
    !answers.every((answer) => violationIds.has(answer.violationId) && answer.answer >= 0) ||
    !skips.every((skip) => violationIds.has(skip.violationId)) ||
    !revealed.every((id) => violationIds.has(id))
  ) {
    throw new Error('Invalid history references');
  }

  validateAnswerMaterials(answers, violations);

  return { ...value, schemaVersion: 2, violations, answers, trips, skips, revealed };
}
