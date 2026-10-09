import type { AnswerAttempt, Violation } from '../world/model';
import {
  CAUSE_CODES,
  RULE_TYPES,
  type CauseCode,
  type Question,
  type RuleType,
} from './question-types';

export type { CauseCode, Question, RuleType } from './question-types';

export function validateQuestion(value: unknown): Question {
  const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

  const strings = (v: Record<string, unknown>, keys: string[]) =>
    keys.every((k) => typeof v[k] === 'string' && String(v[k]).length > 0);

  if (
    !object(value) ||
    !strings(value, ['id', 'version', 'title', 'explanation']) ||
    !['demo', 'verified'].includes(String(value.status)) ||
    !RULE_TYPES.some((rule) => rule === value.rule) ||
    !Array.isArray(value.options) ||
    value.options.length < 2 ||
    !value.options.every((o: unknown) => typeof o === 'string' && o.length > 0) ||
    new Set(value.options).size !== value.options.length ||
    !Number.isInteger(value.correctIndex) ||
    Number(value.correctIndex) < 0 ||
    Number(value.correctIndex) >= value.options.length ||
    !object(value.reference) ||
    !strings(value.reference, ['label', 'url', 'verification']) ||
    !String(value.reference.url).startsWith('https://') ||
    (value.matches !== undefined &&
      (!Array.isArray(value.matches) ||
        !value.matches.every((c: unknown) => CAUSE_CODES.some((code) => code === c)))) ||
    (value.context !== undefined && value.context !== 'same' && value.context !== 'related') ||
    (value.difference !== undefined && typeof value.difference !== 'string')
  ) {
    throw new Error('Invalid question shape');
  }

  if (
    value.official !== undefined &&
    (!object(value.official) ||
      !strings(value.official, ['category', 'source', 'checkedOn', 'usage']))
  ) {
    throw new Error('Invalid official metadata');
  }

  if (
    value.image !== undefined &&
    (!object(value.image) || !strings(value.image, ['src', 'alt', 'source', 'usage']))
  ) {
    throw new Error('Invalid image metadata');
  }

  const q = value as unknown as Question;

  if (
    q.status === 'verified' &&
    (!q.official ||
      !q.matches?.length ||
      !q.context ||
      !q.official.source.startsWith('https://') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(q.official.checkedOn) ||
      !q.official.usage ||
      q.official.category !== 'B' ||
      !Number.isInteger(q.official.ticket) ||
      q.official.ticket < 1 ||
      !Number.isInteger(q.official.number) ||
      q.official.number < 1)
  ) {
    throw new Error('Не подтверждены реквизиты официального вопроса');
  }

  if (q.context === 'related' && !q.difference) {
    throw new Error('Не указано отличие ситуации');
  }

  if (
    q.image &&
    (!q.image.src.startsWith(`/assets/questions/${q.id}/${q.version}/`) ||
      q.image.src.includes('..') ||
      !q.image.alt ||
      !q.image.source ||
      !q.image.usage)
  ) {
    throw new Error('Не проверен ресурс вопроса');
  }

  return q;
}

/** Проверяет покрытие причин, включая архивный STOP без явных matches. */
export function questionCoversCauses(
  question: { readonly matches?: readonly CauseCode[] },
  causes: readonly CauseCode[],
): boolean {
  if (question.matches) {
    const matches = question.matches;

    return causes.every((code) => matches.includes(code));
  }

  return causes.every((code) => code === 'stop-line');
}

export function selectQuestion(
  questions: Question[],
  rule: RuleType,
  causes: CauseCode[] = [],
  answers: AnswerAttempt[] = [],
): Question | undefined {
  const suitable = questions.filter(
    (q) =>
      q.rule === rule &&
      (q.matches !== undefined || (rule === 'stop' && q.status === 'demo')) &&
      questionCoversCauses(q, causes),
  );

  const rank = (q: Question) => {
    const attempts = answers.filter((a) => a.questionId === q.id && a.contentVersion === q.version);

    return !attempts.length ? 0 : attempts.some((a) => !a.correct) ? 1 : 2;
  };

  return [...suitable].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))[0];
}

export function selectIncidentQuestion(
  questions: Question[],
  incident: Pick<Violation, 'type' | 'causes'>,
  answers: AnswerAttempt[],
) {
  return selectQuestion(
    questions,
    incident.type,
    incident.causes.map((c) => c.code),
    answers,
  );
}

export function evaluateAnswer(question: Question, answer: number) {
  if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
    throw new Error('Invalid answer');
  }

  return answer === question.correctIndex;
}
