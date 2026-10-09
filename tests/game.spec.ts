import { expect, test, type Page } from '@playwright/test';
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#road')).toBeFocused();
}
async function violate(page: Page) {
  await page.keyboard.down('KeyW');
  await expect(page.getByRole('dialog', { name: 'Разбор нарушения' })).toBeVisible({
    timeout: 12000,
  });
  await page.keyboard.up('KeyW');
}
test('STOP → optional answer → retry → history persists after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await violate(page);
  await expect(page.getByText('Авторский учебный вопрос · не официальный билет')).toBeVisible();
  await page.getByRole('button', { name: 'Повторить ситуацию' }).click();
  await expect(page.getByTestId('speed')).toHaveText('00');
  await violate(page);
  await page.getByRole('button', { name: 'Перед стоп-линией, даже если дорога свободна' }).click();
  await expect(page.getByRole('status')).toContainText('Самостоятельный ответ сохранён');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть журнал', exact: true }).click();
  await expect(page.getByRole('button', { name: /Проезд без остановки/ })).toHaveCount(2);
  await expect(page.getByText('История хранится в этом браузере')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Журнал/ }).click();
  await expect(page.getByRole('button', { name: /Проезд без остановки/ })).toHaveCount(2);
  await page
    .getByRole('button', { name: /Проезд без остановки/ })
    .first()
    .click();
  await expect(
    page.getByText('Точное состояние этой ситуации недоступно.', { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('pause and focus loss stop motion and release input', async ({ page }) => {
  await start(page);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('KeyW');
  await expect(page.getByText('Небольшая остановка')).toBeVisible();
  const speed = await page.getByTestId('speed').textContent();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('speed')).toHaveText(speed!);
  await page.getByRole('button', { name: 'Продолжить поездку', exact: true }).click();
  await page.waitForTimeout(500);
  expect(Number(await page.getByTestId('speed').textContent())).toBeLessThan(Number(speed));
});
test('dashboard restarts and finishes a trip while keeping history', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('button', { name: 'О проекте' })).toHaveCount(0);
  await violate(page);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const controls = page.getByRole('group', { name: 'Управление поездкой' });
  await controls.getByRole('button', { name: 'Пауза', exact: true }).click();
  await expect(page.getByText('Небольшая остановка')).toBeVisible();
  await controls.getByRole('button', { name: 'Начать поездку заново' }).click();
  await expect(page.getByTestId('speed')).toHaveText('00');
  await expect(page.getByText('Небольшая остановка')).toBeHidden();
  await expect(page.locator('#road')).toBeFocused();
  await controls.getByRole('button', { name: 'Завершить поездку' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: /Проезд без остановки/ })).toHaveCount(1);
  await expect(controls).toBeHidden();
});
test('initial layout renders without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/city-desktop.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 650 },
  { width: 800, height: 800 },
  { width: 700, height: 700 },
]) {
  test(`all trip panels fit one viewport at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const mapBeforeStart = await page.locator('.map-card').boundingBox();
    const fittedCanvas = await page.locator('.phaser-world').evaluate((parent) => {
      const { width, height, x, y } = parent.getBoundingClientRect();
      const scale = Math.min(width / 960, height / 800);
      return {
        width: 960 * scale,
        height: 800 * scale,
        x: x + Math.floor((width - 960 * scale) / 2),
        y: y + Math.floor((height - 800 * scale) / 2),
      };
    });
    const expectStableMap = async () => {
      expect(await page.locator('.map-card').boundingBox()).toEqual(mapBeforeStart);
      await expect
        .poll(async () => {
          const canvas = await page.locator('canvas').boundingBox();
          return canvas
            ? Math.max(
                ...(['x', 'y', 'width', 'height'] as const).map((key) =>
                  Math.abs(canvas[key] - fittedCanvas[key]),
                ),
              )
            : Infinity;
        })
        .toBeLessThan(1);
    };
    await expectStableMap();
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await expectStableMap();
    const welcome = await page.locator('.welcome').boundingBox();
    expect(Math.abs(welcome!.x + welcome!.width / 2 - viewport.width / 2)).toBeLessThan(1);
    expect(Math.abs(welcome!.y + welcome!.height / 2 - viewport.height / 2)).toBeLessThan(1);
    for (const mode of ['initial', 'driving', 'instructions']) {
      if (mode === 'driving') {
        await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
        await expect(page.locator('#road')).toBeFocused();
        await expectStableMap();
        const map = await page.locator('.map-card').boundingBox();
        const dashboard = await page.locator('.dashboard').boundingBox();
        expect(dashboard!.y).toBeGreaterThanOrEqual(map!.y + map!.height);
        await expect
          .poll(() =>
            page.locator('canvas').evaluate((canvas) => {
              const world = canvas.getBoundingClientRect();
              const map = document.querySelector('.map-card')!.getBoundingClientRect();
              return (
                world.top >= map.top &&
                world.bottom <= map.bottom &&
                world.left >= map.left &&
                world.right <= map.right
              );
            }),
          )
          .toBe(true);
      }
      if (mode === 'instructions') {
        const toggle = page.locator('.controls-toggle');
        const progressBefore = await page.locator('.progress-card').boundingBox();
        await expect(page.locator('.control-row').first()).toBeHidden();
        await toggle.focus();
        await page.keyboard.press('Space');
        await expect(page.locator('.control-row').first()).toBeVisible();
        expect(await page.locator('.progress-card').boundingBox()).toEqual(progressBefore);
        const overlaysProgress = await page.locator('.controls-content').evaluate((content) => {
          const popup = content.getBoundingClientRect();
          const progress = document.querySelector('.progress-card')!.getBoundingClientRect();
          const x = Math.max(popup.left, progress.left) + 10;
          const y = Math.max(popup.top, progress.top) + 10;
          return content.contains(document.elementFromPoint(x, y));
        });
        expect(overlaysProgress).toBe(true);
      }
      if (viewport.width > 900 && viewport.height > 680) {
        const map = await page.locator('.map-card').boundingBox();
        const lesson = await page.locator('.lesson-card').boundingBox();
        const progress = await page.locator('.progress-card').boundingBox();
        expect(Math.abs(lesson!.y - map!.y)).toBeLessThan(1);
        expect(Math.abs(progress!.y + progress!.height - (map!.y + map!.height))).toBeLessThan(1);
      }
      const layout = await page.evaluate(() => {
        const rect = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect();
        const footer = rect('.footer');
        const panels = ['.map-card', '.lesson-card', '.controls-card', '.progress-card'];
        if (document.querySelector('.controls-card[open]')) {
          panels.push('.controls-content');
        }
        if (document.querySelector('.dashboard')) {
          panels.push('.dashboard', '.trip-controls');
        }
        return {
          overflowX: document.documentElement.scrollWidth > innerWidth,
          overflowY: document.documentElement.scrollHeight > innerHeight,
          clippedPanels: panels.filter((selector) => {
            const r = rect(selector);
            return r.top < 0 || r.left < 0 || r.right > innerWidth + 1 || r.bottom > footer.top + 1;
          }),
        };
      });
      expect(layout).toEqual({ overflowX: false, overflowY: false, clippedPanels: [] });
    }
    await page.locator('.controls-toggle').press('Enter');
    await expect(page.locator('.control-row').first()).toBeHidden();
  });
}

test('incident modal fits the viewport before and after revealing, answering and reopening', async ({
  page,
}) => {
  await start(page);
  await violate(page);
  for (const state of ['question', 'explanation', 'answer', 'saved']) {
    if (state === 'explanation') {
      await page.getByRole('button', { name: 'Показать разбор', exact: true }).click();
    }
    if (state === 'answer') {
      await page.getByRole('button', { name: 'После стоп-линии, если никого нет' }).click();
    }
    if (state === 'saved') {
      await expect(page.getByText('История хранится в этом браузере')).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Поехать в город', exact: true }),
      ).toBeEnabled();
      await page.getByRole('button', { name: /^Журнал/ }).click();
      await page.getByRole('button', { name: /Проезд без остановки/ }).click();
    }
    for (const [width, height] of [
      [1440, 900],
      [1280, 720],
      [1024, 650],
      [700, 700],
      [600, 700],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      const dialog = page.getByRole('dialog', { name: 'Разбор нарушения' });
      const layout = await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const clipped = [...el.querySelectorAll('button, h2, h3, p, a')].some((child) => {
          const box = child.getBoundingClientRect();
          return (
            box.top < r.top ||
            box.bottom > r.bottom + 1 ||
            box.left < r.left ||
            box.right > r.right + 1
          );
        });
        return {
          inside:
            r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1,
          scroll: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
          clipped,
        };
      });
      expect(layout, `${state} at ${width}×${height}`).toEqual({
        inside: true,
        scroll: false,
        clipped: false,
      });
      if (state === 'answer' && width === 1024) {
        await page.screenshot({ path: 'test-results/incident-compact.png' });
      }
    }
  }
});
