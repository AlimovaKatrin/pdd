import { emptyHistory, type History } from '../../domain/world/model';
import type { HistoryRepository } from '../../use-cases/ports';
import { validateHistory } from './history-validation';

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
