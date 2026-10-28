import { chromium, expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cityJournal, cityJournalCauses } from '../fixtures/city-journal';
import { dialogFits, loadJournalFixture } from './journal-fixture';

test('city guide shows every supported rule and fits all desktop layouts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();

  const guide = page.getByRole('region', { name: 'ЗНАКОМИМСЯ С ГОРОДОМ' });

  const topics = [
    ['STOP', 'Остановка перед STOP'],
    ['Скорость', 'Соблюдайте ограничение'],
    ['Светофор', 'Дождитесь зелёного'],
    ['Поворот', 'Покажите направление'],
    ['Пешеход', 'Уступите пешеходу'],
    ['Встречная полоса', 'Оставайтесь на своей полосе'],
    ['Левый поворот', 'Пропустите встречных'],
    ['Главная дорога', 'Уступите главной дороге'],
    ['Помеха справа', 'Пропустите машину справа'],
    ['Завершение проезда', 'Дайте закончить движение'],
  ];

  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 650],
    [800, 800],
    [700, 700],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(guide.locator('.guide-topics button')).toHaveCount(topics.length);

    const bounds = await guide.boundingBox();

    for (const [index, [label, title]] of topics.entries()) {
      const button = guide.getByRole('button', { name: label, exact: true });

      await button.focus();
      await button.press('Space');
      await expect(button).toBeFocused();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(button).toHaveCSS('background-color', 'rgb(36, 92, 70)');
      await expect(guide.locator('[aria-pressed="true"]')).toHaveCount(1);
      await expect(guide.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(guide.getByLabel(`Ситуация ${index + 1} из 10`, { exact: true })).toBeVisible();
      expect(await guide.boundingBox()).toEqual(bounds);
      expect(
        await guide.evaluate((element) => {
          const card = element.getBoundingClientRect();

          return [...element.querySelectorAll('button, h2, p, .guide-heading')].every((child) => {
            const box = child.getBoundingClientRect();

            return (
              box.left >= card.left &&
              box.right <= card.right &&
              box.top >= card.top &&
              box.bottom <= card.bottom
            );
          });
        }),
      ).toBe(true);
    }

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/city-guide-${width}-${height}.png` });
  }
});

test('desktop city reviews and a thousand records fit, retain scroll and restore focus', async ({
  page,
}) => {
  await loadJournalFixture(page, cityJournal(1000));

  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 650],
    [800, 800],
    [700, 700],
  ]) {
    await page.setViewportSize({ width, height });

    for (let index = 0; index < cityJournalCauses.length; index++) {
      const entry = page.locator(`[data-entry-id="city-event-${index}"]`);

      await entry.click();
      await dialogFits(page);
      await expect(page.locator('.cause-facts')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Повторить ситуацию', exact: true }),
      ).toHaveCount(0);

      if ((width === 1024 && index === 4) || (width === 700 && index === 7)) {
        await page.screenshot({ path: `test-results/city-review-${width}-${index}.png` });
      }

      await page.keyboard.press('Escape');
      await expect(entry).toBeFocused();
    }
  }

  await page.setViewportSize({ width: 1024, height: 650 });

  const last = page.locator('.journal-list > button').last();

  await last.scrollIntoViewIfNeeded();

  const scroll = await page.locator('.journal-list').evaluate((element) => element.scrollTop);

  expect(scroll).toBeGreaterThan(1000);
  await last.click();
  await page.keyboard.press('Escape');
  await expect(last).toBeFocused();
  expect(await page.locator('.journal-list').evaluate((element) => element.scrollTop)).toBeCloseTo(
    scroll,
    0,
  );
});

test('city review supports real browser zoom at 125, 150 and 200 percent', async ({ baseURL }) => {
  const directory = await mkdtemp(join(tmpdir(), 'pdd-city-zoom-'));

  await writeFile(
    join(directory, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'PDD city zoom test',
      version: '1.0',
      permissions: ['tabs'],
      background: { service_worker: 'worker.js' },
    }),
  );
  await writeFile(join(directory, 'worker.js'), 'chrome.tabs.onUpdated.addListener(() => {});');

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${directory}`, `--load-extension=${directory}`],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

    const page = await context.newPage();

    await loadJournalFixture(page, cityJournal(), baseURL);

    for (const zoom of [1.25, 1.5, 2]) {
      await worker.evaluate(
        async ({ factor, url }) => {
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

          await api.tabs.setZoom(tabs.find((tab) => tab.url?.startsWith(url))!.id, factor);
        },
        { factor: zoom, url: baseURL! },
      );
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(Math.round(1440 / zoom));
      await page.locator('[data-entry-id="city-event-4"]').click();

      for (let step = 0; step < 12; step++) {
        await page.keyboard.press('Tab');
        expect(
          await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')),
        ).toBe(true);
      }

      await page.getByRole('button', { name: 'Назад в журнал' }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: 'Назад в журнал' })).toBeVisible();
      await page.screenshot({ path: `test-results/city-zoom-${zoom}.png` });
      await page.keyboard.press('Escape');
    }
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('repeated renderer mounts release old DOM nodes and event listeners', async ({ page }) => {
  await page.goto('/tests/e2e/performance-harness.html');
  await expect(page.locator('canvas')).toHaveCount(1);

  const client = await page.context().newCDPSession(page);

  await client.send('Performance.enable');

  async function remountAndMeasure() {
    await page.evaluate(() => window.cityPerf.remount());
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.waitForTimeout(200);
    await client.send('HeapProfiler.collectGarbage');
    await client.send('HeapProfiler.collectGarbage');

    const result = await client.send('Performance.getMetrics');

    return Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]));
  }

  const baseline = await remountAndMeasure();

  for (let iteration = 0; iteration < 5; iteration++) {
    const current = await remountAndMeasure();

    expect(current.Nodes - baseline.Nodes).toBeLessThan(100);
    expect(current.JSEventListeners).toBe(baseline.JSEventListeners);
    expect(await page.evaluate(() => window.cityPerf.read().activeWorlds)).toBe(1);
  }

  await page.evaluate(() => window.cityPerf.dispose());
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => window.cityPerf.read().activeWorlds)).toBe(0);
});
