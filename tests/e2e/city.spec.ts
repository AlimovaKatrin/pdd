import { expect, test, type Page } from '@playwright/test';
import {
  driveAcrossUnregulatedRoad,
  driveLeftAtGreen,
  drivePastSignalPedestrian,
} from './priority-driving';

test('new green still requires yielding to the pedestrian finishing the crossing', async ({
  page,
}) => {
  test.setTimeout(100000);
  await page.setViewportSize({ width: 1024, height: 650 });
  await page.goto('/tests/e2e/city-harness.html?signal-pedestrian');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await drivePastSignalPedestrian(page, false);

  const dialog = page.getByRole('dialog', { name: 'Разбор нарушения', exact: true });

  await expect(dialog.getByText('Не дали пешеходу закончить переход')).toBeVisible();
  await expect(dialog.getByText(/П1 имел преимущество/)).toBeVisible();
  await page.screenshot({ path: 'test-results/signal-pedestrian.png' });
  await dialog.getByRole('button', { name: 'Повторить ситуацию', exact: true }).click();
  await drivePastSignalPedestrian(page, true);
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => window.cityTest.pose().y)).toBeLessThan(164);
  expect(await page.evaluate(() => window.cityTest.snapshot().history.violations.length)).toBe(1);
});

test('equal road explains right-side priority and permits yielding on retry', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1024, height: 650 });
  await page.goto('/tests/e2e/city-harness.html?equal-road');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await driveAcrossUnregulatedRoad(page, false, 'east');

  const dialog = page.getByRole('dialog', { name: 'Разбор нарушения', exact: true });

  await expect(
    dialog.getByRole('link', { name: 'ПДД РФ · Пункты 13.10, 13.11', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/М1: с юга, прямо/)).toBeVisible();
  await page.screenshot({ path: 'test-results/equal-road.png' });
  await dialog.getByRole('button', { name: 'Повторить ситуацию', exact: true }).click();
  await driveAcrossUnregulatedRoad(page, true, 'east');
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => window.cityTest.pose().x)).toBeGreaterThan(300);
  expect(await page.evaluate(() => window.cityTest.snapshot().history.violations.length)).toBe(1);
});

test('secondary road explains the main-road priority and supports a corrected retry', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1024, height: 650 });
  await page.goto('/tests/e2e/city-harness.html?main-road');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await driveAcrossUnregulatedRoad(page, false, 'south');

  const dialog = page.getByRole('dialog', { name: 'Разбор нарушения', exact: true });

  await expect(
    dialog.getByRole('link', { name: 'ПДД РФ · Пункт 13.9', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/Ваша дорога — второстепенная, дорога М1 — главная/)).toBeVisible();
  await page.screenshot({ path: 'test-results/main-road.png' });
  await dialog.getByRole('button', { name: 'Повторить ситуацию', exact: true }).click();
  await driveAcrossUnregulatedRoad(page, true, 'south');
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => window.cityTest.pose().y)).toBeGreaterThan(60);
  expect(await page.evaluate(() => window.cityTest.snapshot().history.violations.length)).toBe(1);
});

test('left-turn priority identifies the car, supports correction and survives reload', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1024, height: 650 });
  await page.goto('/tests/e2e/city-harness.html?priority');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await page.keyboard.press('KeyQ');
  await driveLeftAtGreen(page, false);

  const dialog = page.getByRole('dialog', { name: 'Разбор нарушения', exact: true });

  await expect(dialog.getByText('Не уступили встречной машине на зелёный')).toBeVisible();
  await expect(dialog.getByText(/М1: с севера, прямо/)).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'ПДД РФ · Пункт 13.4', exact: true }),
  ).toBeVisible();
  await expect(dialog.locator('.incident-question')).toHaveCount(0);
  expect(
    await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();

      return (
        bounds.top >= 0 &&
        bounds.bottom <= innerHeight &&
        element.scrollHeight <= element.clientHeight
      );
    }),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/priority-left.png' });
  await dialog.getByRole('button', { name: 'Повторить ситуацию', exact: true }).click();
  await driveLeftAtGreen(page, true);
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => window.cityTest.pose().x)).toBeLessThan(146);
  expect(await page.evaluate(() => window.cityTest.snapshot().history.violations.length)).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await page.getByRole('button', { name: /Журнал/ }).click();
  await page.getByRole('button', { name: /Не уступили встречной машине на зелёный/ }).click();
  await expect(dialog.getByText(/М1: с севера, прямо/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Повторить ситуацию', exact: true })).toHaveCount(
    0,
  );
});

async function canvasPixels(page: Page) {
  return page.locator('canvas').evaluate(async (canvas: HTMLCanvasElement) => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    return canvas.toDataURL();
  });
}

test('releasing a driving brake cannot activate the newly focused dialog button', async ({
  page,
}) => {
  await page.goto('/tests/e2e/city-harness.html');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await expect(page.locator('#road')).toBeFocused();
  await page.keyboard.down('Space');
  await page.evaluate(() => window.cityTest.pause());
  await expect(page.getByText('Небольшая остановка')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить поездку', exact: true }).focus();
  // An OS key repeat can arrive after focus moves, while the original brake is still held.
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect(page.getByText('Небольшая остановка')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('Небольшая остановка')).not.toBeVisible();
});

for (const [width, height] of [
  [1024, 650],
  [700, 700],
]) {
  test(`opposing-lane review, correction and saved history at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/tests/e2e/city-harness.html');
    await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');

    const dialog = page.getByRole('dialog', { name: 'Разбор нарушения', exact: true });

    await expect(dialog).toBeVisible({ timeout: 10000 });
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await expect(dialog.getByText('Движение по запрещённой встречной полосе')).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Пункт 9.1/ })).toBeVisible();
    expect(
      await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();

        return (
          bounds.top >= 0 &&
          bounds.bottom <= innerHeight &&
          element.scrollHeight <= element.clientHeight
        );
      }),
    ).toBe(true);
    await page.screenshot({ path: `test-results/oncoming-${width}.png` });
    await dialog.getByRole('button', { name: 'Повторить ситуацию', exact: true }).click();
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => window.cityTest.snapshot().history.violations.length)).toBe(1);
    await page.reload();
    await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
    await page.getByRole('button', { name: /Журнал/ }).click();
    await page.getByRole('button', { name: /Движение по запрещённой встречной полосе/ }).click();
    await expect(dialog.getByRole('link', { name: /Пункт 9.1/ })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Повторить ситуацию', exact: true }),
    ).toHaveCount(0);
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

for (const { block, points } of [
  {
    block: 'north-west',
    points: [
      [163.5, 160],
      [40, 156.5],
      [43.5, 40],
      [160, 43.5],
      [156.5, 155],
    ],
  },
  {
    block: 'north-east',
    points: [
      [163.5, 40],
      [280, 43.5],
      [276.5, 160],
      [160, 156.5],
      [163.5, 100],
    ],
  },
  {
    block: 'south-east',
    points: [
      [163.5, 160],
      [280, 163.5],
      [276.5, 280],
      [160, 276.5],
      [163.5, 220],
    ],
  },
  {
    block: 'south-west',
    points: [
      [43.5, 160],
      [160, 163.5],
      [156.5, 280],
      [40, 276.5],
      [43.5, 240],
    ],
  },
]) {
  test(`keyboard route closes the ${block} block with the car visible`, async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(`/tests/e2e/city-harness.html?block=${block}`);
    await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();

    let target = 0;

    let held = new Set<string>();

    for (let iteration = 0; iteration < 1600 && target < points.length; iteration++) {
      if (await page.getByRole('dialog', { name: 'Разбор нарушения' }).isVisible()) {
        for (const key of held) {
          await page.keyboard.up(key);
        }

        held.clear();

        // Releasing a key pressed after the dialog appeared may legitimately activate its button.
        if (await page.getByRole('dialog', { name: 'Разбор нарушения' }).isVisible()) {
          await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
        }
      }

      await expect(
        page.getByRole('dialog', { name: 'Столкновение', exact: true }),
      ).not.toBeVisible();

      const world = await page.evaluate(() => window.cityTest.world());

      const pose = world.vehicle;

      const [x, y] = points[target];

      if (Math.hypot(x - pose.x, y - pose.y) < 5) {
        console.info('Reached city waypoint', target, pose.x, pose.y);
        target++;
        continue;
      }

      const desired = Math.atan2(y - pose.y, x - pose.x);

      const angle = Math.atan2(Math.sin(desired - pose.heading), Math.cos(desired - pose.heading));

      const blocked = world.traffic.vehicles.some(({ vehicle }) => {
        const dx = vehicle.x - pose.x;

        const dy = vehicle.y - pose.y;

        const ahead = dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading);

        const lateral = -dx * Math.sin(pose.heading) + dy * Math.cos(pose.heading);

        return ahead > 0 && ahead < 12 && Math.abs(lateral) < 2.5;
      });

      const keys = new Set([blocked || pose.speed > 6 ? 'Space' : 'KeyW']);

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
    await page.screenshot({ path: `test-results/city-route-${block}.png` });
  });
}

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

    await expectCanvasFillsMap(page);

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

async function expectCanvasFillsMap(page: Page) {
  await expect
    .poll(async () => {
      const canvas = await page.locator('canvas').boundingBox();

      const map = await page.locator('.phaser-world').boundingBox();

      if (!canvas || !map) {
        return false;
      }

      return (
        Math.abs(canvas.x - map.x) < 1 &&
        Math.abs(canvas.y - map.y) < 1 &&
        Math.abs(canvas.width - map.width) < 1 &&
        Math.abs(canvas.height - map.height) < 1
      );
    })
    .toBe(true);
}

test('camera fills the map after resizing a paused trip', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();

  for (const [width, height] of [
    [1024, 650],
    [700, 700],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expectCanvasFillsMap(page);
    await expect(page.getByText('Небольшая остановка')).toBeVisible();

    const scale = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const bounds = canvas.getBoundingClientRect();

      return { x: bounds.width / canvas.width, y: bounds.height / canvas.height };
    });

    expect(scale.x).toBeCloseTo(1, 2);
    expect(scale.y).toBeCloseTo(1, 2);

    const pixels = await canvasPixels(page);

    await page.waitForTimeout(200);
    expect(await canvasPixels(page)).toBe(pixels);
  }
});

test('safe return snaps the camera while retaining the traffic and another pause', async ({
  page,
}) => {
  await page.goto('/tests/e2e/city-harness.html');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyW');

  const before = await page.evaluate(() => {
    window.cityTest.pause();

    return window.cityTest.world();
  });

  await page
    .getByRole('group', { name: 'Управление поездкой' })
    .getByRole('button', { name: 'Вернуться на дорогу', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Небольшая остановка')).toBeVisible();

  const returned = await page.evaluate(() => window.cityTest.world());

  expect(returned.traffic).toEqual(before.traffic);
  expect(returned.tick).toBe(before.tick);
  expect(returned.vehicle.speed).toBe(0);
  await page.waitForTimeout(100);

  const centre = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;

    let x = 0;

    let y = 0;

    let count = 0;

    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] === 52 && pixels[offset + 1] === 120 && pixels[offset + 2] === 196) {
        x += (offset / 4) % canvas.width;
        y += Math.floor(offset / 4 / canvas.width);
        count++;
      }
    }

    return { x: x / count - canvas.width / 2, y: y / count - canvas.height / 2 };
  });

  expect(Math.abs(centre.x)).toBeLessThan(5);
  expect(Math.abs(centre.y)).toBeLessThan(5);

  const pixels = await canvasPixels(page);

  await page.waitForTimeout(200);
  expect(await canvasPixels(page)).toBe(pixels);
});

for (const [width, height] of [
  [1280, 720],
  [1024, 650],
]) {
  test(`collision stops the city and offers a safe return at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/tests/e2e/city-harness.html?collision');
    await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
    await page.keyboard.down('KeyW');

    const oncoming = page.getByRole('dialog', { name: 'Разбор нарушения', exact: true });

    await expect(oncoming).toBeVisible({ timeout: 10000 });
    await page.keyboard.up('KeyW');
    await expect(oncoming.getByText('Движение по запрещённой встречной полосе')).toBeVisible();
    await oncoming.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.keyboard.down('KeyW');

    const dialog = page.getByRole('dialog', { name: 'Столкновение', exact: true });

    await expect(dialog).toBeVisible({ timeout: 10000 });
    await page.keyboard.up('KeyW');
    await expect(dialog.getByText('М1:', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Повторить ситуацию' })).toHaveCount(0);

    const before = await page.evaluate(() => ({
      world: window.cityTest.world(),
      snapshot: window.cityTest.snapshot(),
    }));

    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.cityTest.world())).toEqual(before.world);
    expect(
      await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();

        return (
          bounds.top >= 0 &&
          bounds.bottom <= innerHeight &&
          element.scrollHeight <= element.clientHeight
        );
      }),
    ).toBe(true);
    await page.screenshot({ path: `test-results/collision-${width}.png` });
    await page.evaluate(() => window.cityTest.pause());
    await dialog.getByRole('button', { name: 'Вернуться на дорогу' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('speed')).toHaveText('00');

    const after = await page.evaluate(() => ({
      world: window.cityTest.world(),
      snapshot: window.cityTest.snapshot(),
    }));

    expect(after.snapshot.activeTripId).toBe(before.snapshot.activeTripId);
    expect(after.snapshot.history.violations).toEqual(before.snapshot.history.violations);
    expect(after.world.traffic).toEqual(before.world.traffic);
    await page.getByRole('button', { name: 'Продолжить поездку', exact: true }).click();
    await page.waitForTimeout(1500);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('speed')).toHaveText('00');
  });
}
