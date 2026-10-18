import { chromium, expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('real browser zoom at 125–200% preserves reading, keyboard focus and continuation', async () => {
  const extension = await mkdtemp(join(tmpdir(), 'pdd-zoom-'));

  await writeFile(
    join(extension, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'Local PDD zoom check',
      version: '1.0',
      permissions: ['tabs'],
      background: { service_worker: 'worker.js' },
    }),
  );
  await writeFile(join(extension, 'worker.js'), 'chrome.tabs.onUpdated.addListener(() => {});');

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1440, height: 900 },
  });

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

    const page = await context.newPage();

    await page.goto('http://127.0.0.1:5173');

    for (const zoom of [1.25, 1.5, 2]) {
      // Execute the browser extension API in its worker, not in the game page.
      await worker.evaluate(async (factor) => {
        const api = (
          globalThis as unknown as {
            chrome: {
              tabs: {
                query: (query: object) => Promise<{ id: number; url?: string }[]>;
                setZoom: (id: number, zoom: number) => Promise<void>;
              };
            };
          }
        ).chrome;

        const tabs = await api.tabs.query({});

        const tab = tabs.find((candidate) => candidate.url?.startsWith('http://127.0.0.1:5173'))!;

        await api.tabs.setZoom(tab.id, factor);
      }, zoom);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(Math.round(1440 / zoom));
      await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
      await page.keyboard.down('KeyW');
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 12000 });
      await page.keyboard.up('KeyW');
      await page.getByRole('button', { name: 'Показать разбор', exact: true }).click();
      await expect(page.getByRole('link', { name: /знак 2.5/ })).toBeVisible();

      for (let step = 0; step < 15; step++) {
        await page.keyboard.press('Tab');
        expect(
          await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')),
        ).toBe(true);
      }

      const box = await page.getByRole('dialog').boundingBox();

      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.width).toBeLessThanOrEqual(Math.round(1440 / zoom));
      await page.getByRole('button', { name: 'Продолжить', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/zoom-${zoom}.png` });
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await expect(page.locator('#road')).toBeFocused();
      await page.getByRole('button', { name: 'Завершить поездку', exact: true }).click();
      await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
      await page.reload();
    }
  } finally {
    await context.close();
    await rm(extension, { recursive: true });
  }
});
