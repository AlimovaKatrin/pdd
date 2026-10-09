import { archivedStopQuestion } from '../../content/questions/stop-demo-1';
import { validateQuestion } from '../../domain/learning/question';
import { cause } from '../../domain/violations/causes';
import { emptyHistory, type History } from '../../domain/world/model';
import type { HistoryRepository } from '../../use-cases/ports';
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const strings = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof v[k] === 'string');
function validateLegacy(value: unknown): History {
  if (
    !object(value) ||
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
    !violations.every(
      (v) =>
        object(v) &&
        strings(v, [
          'id',
          'tripId',
          'attemptId',
          'date',
          'mapVersion',
          'rulesVersion',
          'roadObjectId',
        ]) &&
        v.type === 'stop' &&
        typeof v.speed === 'number' &&
        Number.isFinite(v.speed) &&
        Number.isInteger(v.tick) &&
        Number.isInteger(v.episode),
    )
  ) {
    throw new Error('Invalid violations');
  }
  const ids = violations.map((v) => (object(v) ? v.id : undefined));
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate violations');
  }
  if (
    !answers.every(
      (a) =>
        object(a) &&
        strings(a, ['id', 'violationId', 'questionId', 'contentVersion', 'date']) &&
        Number.isInteger(a.answer) &&
        typeof a.correct === 'boolean' &&
        typeof a.assisted === 'boolean' &&
        ids.includes(a.violationId),
    )
  ) {
    throw new Error('Invalid answers');
  }
  if (
    new Set(answers.map((a) => (object(a) ? a.id : undefined))).size !== answers.length ||
    !revealed.every((id) => typeof id === 'string' && ids.includes(id))
  ) {
    throw new Error('Invalid history references');
  }
  return value as unknown as History;
}
export function validateHistory(value: unknown): History {
  if (!object(value)) {
    throw new Error('Invalid history');
  }
  if (value.schemaVersion === 1) {
    const legacy = validateLegacy(value);
    const violations = legacy.violations.map((v) => {
      const known = legacy.answers
        .filter((a) => a.violationId === v.id)
        .every(
          (a) =>
            a.questionId === archivedStopQuestion.id &&
            a.contentVersion === archivedStopQuestion.version,
        );
      return {
        ...v,
        causes: [cause('stop-line', { speedKmh: v.speed * 3.6 })],
        material: known ? structuredClone(archivedStopQuestion) : null,
        ...(known ? {} : { materialUnavailable: 'Историческая версия материала не найдена.' }),
      };
    });
    const trips = [...new Set(violations.map((v) => v.tripId))].map((id) => ({
      id,
      startedAt: violations.find((v) => v.tripId === id)!.date,
      status: 'legacy' as const,
    }));
    return validateHistory({ ...legacy, schemaVersion: 2, violations, trips, skips: [] });
  }
  if (
    value.schemaVersion !== 2 ||
    !Array.isArray(value.violations) ||
    !Array.isArray(value.answers) ||
    !Array.isArray(value.revealed) ||
    !Array.isArray(value.trips) ||
    !Array.isArray(value.skips)
  ) {
    throw new Error('Unsupported history');
  }
  const violations: unknown[] = value.violations,
    answers: unknown[] = value.answers,
    trips: unknown[] = value.trips,
    skips: unknown[] = value.skips;
  const rules = ['stop', 'speed', 'signal', 'indicator', 'pedestrian'];
  const codes = [
    'stop-line',
    'speed-limit',
    'red-signal',
    'missing-indicator',
    'wrong-indicator',
    'late-indicator',
    'early-indicator-off',
    'pedestrian-obstruction',
  ];
  if (
    !trips.every(
      (t) =>
        object(t) &&
        strings(t, ['id', 'startedAt']) &&
        ['active', 'finished', 'restarted', 'interrupted', 'legacy'].includes(String(t.status)) &&
        (t.finishedAt === undefined || typeof t.finishedAt === 'string'),
    )
  ) {
    throw new Error('Invalid trips');
  }
  const tripIds = trips.map((t) => (object(t) ? t.id : undefined));
  if (
    new Set(tripIds).size !== trips.length ||
    !violations.every(
      (v) =>
        object(v) &&
        strings(v, [
          'id',
          'tripId',
          'attemptId',
          'date',
          'mapVersion',
          'rulesVersion',
          'roadObjectId',
        ]) &&
        tripIds.includes(v.tripId) &&
        rules.includes(String(v.type)) &&
        typeof v.speed === 'number' &&
        Number.isFinite(v.speed) &&
        Number.isInteger(v.tick) &&
        Number.isInteger(v.episode) &&
        Array.isArray(v.causes) &&
        v.causes.length > 0 &&
        v.causes.every(
          (c: unknown) =>
            object(c) &&
            strings(c, ['code', 'rule', 'title', 'explanation', 'reference']) &&
            codes.includes(String(c.code)) &&
            rules.includes(String(c.rule)) &&
            (c.referenceUrl === undefined ||
              (typeof c.referenceUrl === 'string' && c.referenceUrl.startsWith('https://'))) &&
            object(c.facts) &&
            Object.values(c.facts).every(
              (f) =>
                typeof f === 'string' ||
                typeof f === 'boolean' ||
                (typeof f === 'number' && Number.isFinite(f)),
            ),
        ) &&
        (v.eventKeys === undefined ||
          (Array.isArray(v.eventKeys) &&
            v.eventKeys.every((key: unknown) => typeof key === 'string'))) &&
        (v.materialUnavailable === undefined || typeof v.materialUnavailable === 'string') &&
        (v.material === null || !!validateQuestion(v.material)),
    )
  ) {
    throw new Error('Invalid incidents');
  }
  const ids = violations.map((v) => (object(v) ? v.id : undefined));
  if (
    new Set(ids).size !== violations.length ||
    !answers.every(
      (a) =>
        object(a) &&
        strings(a, ['id', 'violationId', 'questionId', 'contentVersion', 'date']) &&
        ids.includes(a.violationId) &&
        Number.isInteger(a.answer) &&
        Number(a.answer) >= 0 &&
        typeof a.correct === 'boolean' &&
        typeof a.assisted === 'boolean',
    ) ||
    !value.revealed.every((id: unknown) => ids.includes(id)) ||
    !skips.every(
      (s) => object(s) && strings(s, ['id', 'violationId', 'date']) && ids.includes(s.violationId),
    )
  ) {
    throw new Error('Invalid history references');
  }
  for (const records of [answers, skips]) {
    if (new Set(records.map((v) => (object(v) ? v.id : undefined))).size !== records.length) {
      throw new Error('Duplicate records');
    }
  }
  const history = value as unknown as History;
  for (const a of history.answers) {
    const q = history.violations.find((v) => v.id === a.violationId)?.material;
    if (
      q &&
      (a.questionId !== q.id ||
        a.contentVersion !== q.version ||
        a.answer >= q.options.length ||
        a.correct !== (a.answer === q.correctIndex))
    ) {
      throw new Error('Answer does not match its pinned material');
    }
  }
  return history;
}
export class IndexedDbHistory implements HistoryRepository {
  constructor(private name = 'pdd-city') {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      let failed = false;
      const timer = setTimeout(() => {
        failed = true;
        reject(new Error('Storage timeout'));
      }, 3000);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('history');
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error ?? new Error('Unable to open history storage'));
      };
      request.onblocked = () => {
        clearTimeout(timer);
        failed = true;
        reject(new Error('Storage blocked'));
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (failed) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }
  async load(): Promise<History> {
    const db = await this.open();
    try {
      const value = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction('history', 'readonly');
        const request = tx.objectStore('history').get('current');
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? new Error('Unable to read history'));
        tx.onabort = () => reject(tx.error ?? new Error('History read aborted'));
      });
      return value === undefined ? emptyHistory() : validateHistory(value);
    } finally {
      db.close();
    }
  }
  async save(history: History) {
    validateHistory(history);
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('history', 'readwrite');
        tx.objectStore('history').put(history, 'current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Unable to save history'));
        tx.onabort = () => reject(tx.error ?? new Error('History write aborted'));
      });
    } finally {
      db.close();
    }
  }
}
