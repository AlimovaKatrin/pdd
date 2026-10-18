import { expect, test, type Page } from '@playwright/test';

async function canvasPixels(page: Page) {
  return page.locator('canvas').evaluate(async (canvas: HTMLCanvasElement) => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    return canvas.toDataURL();
  });
}

test('expanded city follows real driving, freezes during pause, and resets on restart', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();

  const canvas = page.locator('canvas');

  const size = await canvas.boundingBox();

  const initial = await canvasPixels(page);

  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyW');
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await expect(page.getByText('Небольшая остановка')).toBeVisible();

  const paused = await canvasPixels(page);

  await page.waitForTimeout(400);
  expect((await canvasPixels(page)) === paused).toBe(true);
  expect(paused === initial).toBe(false);
  expect(await canvas.boundingBox()).toEqual(size);
  await page.getByRole('button', { name: 'Начать поездку заново', exact: true }).click();
  await expect(page.getByTestId('speed')).toHaveText('00');
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.screenshot({ path: 'test-results/expanded-city.png', fullPage: true });
  expect(await canvas.boundingBox()).toEqual(size);
  expect(errors).toEqual([]);
});

test('keyboard route crosses a junction, turns around a block and returns with the car visible', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto('/tests/e2e/city-harness.html');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();

  const points = [
    [163.5, 160],
    [40, 156.5],
    [43.5, 40],
    [160, 43.5],
    [156.5, 155],
  ];

  let target = 0;

  let held = new Set<string>();

  for (let iteration = 0; iteration < 1600 && target < points.length; iteration++) {
    if (await page.getByRole('dialog', { name: 'Разбор нарушения' }).isVisible()) {
      for (const key of held) {
        await page.keyboard.up(key);
      }

      held.clear();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    }

    const pose = await page.evaluate(() => window.cityTest.pose());

    const [x, y] = points[target];

    if (Math.hypot(x - pose.x, y - pose.y) < 5) {
      console.info('Reached city waypoint', target, pose.x, pose.y);
      target++;
      continue;
    }

    const desired = Math.atan2(y - pose.y, x - pose.x);

    const angle = Math.atan2(Math.sin(desired - pose.heading), Math.cos(desired - pose.heading));

    const keys = new Set([pose.speed > 6 ? 'Space' : 'KeyW']);

    if (Math.abs(angle) > 0.06) {
      keys.add(angle > 0 ? 'KeyD' : 'KeyA');
    }

    for (const key of held) {
      if (!keys.has(key)) {
        await page.keyboard.up(key);
      }
    }

    for (const key of keys) {
      if (!held.has(key)) {
        await page.keyboard.down(key);
      }
    }

    held = keys;

    if (iteration % 30 === 0) {
      const bluePixels = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height).data;

        let count = 0;

        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (pixels[offset] === 52 && pixels[offset + 1] === 120 && pixels[offset + 2] === 196) {
            count++;
          }
        }

        return count;
      });

      expect(bluePixels).toBeGreaterThan(50);
    }

    await page.waitForTimeout(80);
  }

  for (const key of held) {
    await page.keyboard.up(key);
  }

  expect(target).toBe(points.length);
  await page.screenshot({ path: 'test-results/expanded-city-route.png' });
});

for (const [width, height] of [
  [1440, 900],
  [1280, 720],
  [1024, 650],
  [800, 800],
  [700, 700],
]) {
  test(`expanded map keeps layout and scale at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();

    const initial = await page.locator('canvas').boundingBox();

    await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
    await page.locator('summary').filter({ hasText: 'Всё под рукой' }).click();
    expect(await page.locator('canvas').boundingBox()).toEqual(initial);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/city-${width}-${height}.png` });
  });
}

test('safe return snaps the camera to the restored location and preserves another pause', async ({
  page,
}) => {
  await page.goto('/tests/e2e/city-harness.html');
  await expect(page.locator('canvas')).toBeVisible();

  const initial = await canvasPixels(page);

  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => {
    window.cityTest.pause();
    window.cityTest.returnToRoad();
  });
  await expect(page.getByText('Небольшая остановка')).toBeVisible();
  await page.waitForTimeout(100);
  expect((await canvasPixels(page)) === initial).toBe(true);
});
