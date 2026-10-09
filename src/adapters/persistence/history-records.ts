import { CAUSE_CODES, RULE_TYPES } from '../../domain/learning/question-types';
import { validateQuestion } from '../../domain/learning/question';
import type { AnswerAttempt, Cause, Skip, Trip, Violation } from '../../domain/world/model';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const hasStrings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === 'string');

export function hasViolationFields(value: Record<string, unknown>) {
  return (
    hasStrings(value, [
      'id',
      'tripId',
      'attemptId',
      'date',
      'mapVersion',
      'rulesVersion',
      'roadObjectId',
    ]) &&
    typeof value.speed === 'number' &&
    Number.isFinite(value.speed) &&
    Number.isInteger(value.tick) &&
    Number.isInteger(value.episode)
  );
}

export function isAnswer(value: unknown): value is AnswerAttempt {
  return (
    isObject(value) &&
    hasStrings(value, ['id', 'violationId', 'questionId', 'contentVersion', 'date']) &&
    Number.isInteger(value.answer) &&
    typeof value.correct === 'boolean' &&
    typeof value.assisted === 'boolean'
  );
}

export function isTrip(value: unknown): value is Trip {
  return (
    isObject(value) &&
    hasStrings(value, ['id', 'startedAt']) &&
    ['active', 'finished', 'restarted', 'interrupted', 'legacy'].includes(String(value.status)) &&
    (value.finishedAt === undefined || typeof value.finishedAt === 'string')
  );
}

export function isSkip(value: unknown): value is Skip {
  return isObject(value) && hasStrings(value, ['id', 'violationId', 'date']);
}

function isCause(value: unknown): value is Cause {
  return (
    isObject(value) &&
    hasStrings(value, ['code', 'rule', 'title', 'explanation', 'reference']) &&
    CAUSE_CODES.some((code) => code === value.code) &&
    RULE_TYPES.some((rule) => rule === value.rule) &&
    (value.referenceUrl === undefined ||
      (typeof value.referenceUrl === 'string' && value.referenceUrl.startsWith('https://'))) &&
    isObject(value.facts) &&
    Object.values(value.facts).every(
      (fact) =>
        typeof fact === 'string' ||
        typeof fact === 'boolean' ||
        (typeof fact === 'number' && Number.isFinite(fact)),
    )
  );
}

export function isViolation(value: unknown): value is Violation {
  return (
    isObject(value) &&
    hasViolationFields(value) &&
    RULE_TYPES.some((rule) => rule === value.type) &&
    Array.isArray(value.causes) &&
    value.causes.length > 0 &&
    value.causes.every(isCause) &&
    (value.eventKeys === undefined ||
      (Array.isArray(value.eventKeys) &&
        value.eventKeys.every((key: unknown) => typeof key === 'string'))) &&
    (value.materialUnavailable === undefined || typeof value.materialUnavailable === 'string') &&
    (value.material === null || !!validateQuestion(value.material))
  );
}

export function requireUniqueIds(records: readonly { id: string }[]) {
  if (new Set(records.map((record) => record.id)).size !== records.length) {
    throw new Error('Duplicate records');
  }
}
