import { archivedStopQuestion } from '../../content/questions/stop-demo-1';
import { cause } from '../../domain/violations/causes';
import type { AnswerAttempt, History, StopViolation } from '../../domain/world/model';
import { hasViolationFields, isAnswer, isObject, requireUniqueIds } from './history-records';

interface LegacyViolation extends StopViolation {
  id: string;
  tripId: string;
  attemptId: string;
  date: string;
  mapVersion: string;
  rulesVersion: string;
}

interface LegacyHistory {
  schemaVersion: 1;
  violations: LegacyViolation[];
  answers: AnswerAttempt[];
  revealed: string[];
}

function isLegacyViolation(value: unknown): value is LegacyViolation {
  return isObject(value) && value.type === 'stop' && hasViolationFields(value);
}

function readLegacyHistory(value: unknown): LegacyHistory {
  if (
    !isObject(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.violations) ||
    !Array.isArray(value.answers) ||
    !Array.isArray(value.revealed)
  ) {
    throw new Error('Unsupported history');
  }

  const violations: unknown[] = value.violations;

  const answers: unknown[] = value.answers;

  const revealed: unknown[] = value.revealed;

  if (
    !violations.every(isLegacyViolation) ||
    !answers.every(isAnswer) ||
    !revealed.every((id): id is string => typeof id === 'string')
  ) {
    throw new Error('Invalid legacy history');
  }

  requireUniqueIds(violations);
  requireUniqueIds(answers);

  const violationIds = new Set(violations.map((violation) => violation.id));

  if (
    !answers.every((answer) => violationIds.has(answer.violationId)) ||
    !revealed.every((id) => violationIds.has(id))
  ) {
    throw new Error('Invalid history references');
  }

  return { ...value, schemaVersion: 1, violations, answers, revealed };
}

/** Переносит v1 в v2, сохраняя исходные ответы и версии материалов. */
export function migrateHistory(value: unknown): History {
  const legacy = readLegacyHistory(value);

  const violations = legacy.violations.map((violation) => {
    const hasKnownMaterial = legacy.answers
      .filter((answer) => answer.violationId === violation.id)
      .every(
        (answer) =>
          answer.questionId === archivedStopQuestion.id &&
          answer.contentVersion === archivedStopQuestion.version,
      );

    return {
      ...violation,
      causes: [cause('stop-line', { speedKmh: violation.speed * 3.6 })],
      material: hasKnownMaterial ? structuredClone(archivedStopQuestion) : null,
      ...(!hasKnownMaterial && {
        materialUnavailable: 'Историческая версия материала не найдена.',
      }),
    };
  });

  const trips = [...new Set(violations.map((violation) => violation.tripId))].map((id) => ({
    id,
    startedAt: violations.find((violation) => violation.tripId === id)!.date,
    status: 'legacy' as const,
  }));

  return { ...legacy, schemaVersion: 2, violations, trips, skips: [] };
}
