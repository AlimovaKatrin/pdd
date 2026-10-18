import { expect, type Page } from '@playwright/test';
import type { History } from '../../src/domain/world/model';

export async function loadJournalFixture(page: Page, history: History, url = '/') {
  await page.goto(url);
  await expect(page.locator('canvas')).toBeVisible();
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('pdd-city', 1);

      open.onsuccess = () => {
        const db = open.result;

        const transaction = db.transaction('history', 'readwrite');

        transaction.objectStore('history').put(value, 'current');

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };

        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error('History write failed'));
        };
      };

      open.onerror = () => reject(open.error ?? new Error('History open failed'));
    });
  }, history);
  await page.reload();
  await page.getByRole('button', { name: /^Журнал/ }).click();
}

export async function dialogFits(page: Page) {
  const measurements = await page.getByRole('dialog').evaluate((element) => {
    const box = element.getBoundingClientRect();

    return {
      top: box.top,
      bottom: box.bottom,
      right: box.right,
      scroll: element.scrollHeight - element.clientHeight,
    };
  });

  expect(measurements.top).toBeGreaterThanOrEqual(0);
  expect(measurements.bottom).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  expect(measurements.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(measurements.scroll).toBeLessThanOrEqual(1);
}
