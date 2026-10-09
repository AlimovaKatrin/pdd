import { emptyHistory, type History } from '../../domain/world/model';
import type { HistoryRepository } from '../../use-cases/ports';
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const strings = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof v[k] === 'string');
export function validateHistory(value: unknown): History {
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
