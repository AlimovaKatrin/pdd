import { expect, type Page } from '@playwright/test';

/** Only real keyboard input; the fixture exposes immutable observations, not a world setter. */
export async function driveLeftAtGreen(page: Page, yieldFirst: boolean) {
  let held = new Set<string>();

  for (let iteration = 0; iteration < 900; iteration++) {
    if (await page.getByRole('dialog', { name: 'Разбор нарушения', exact: true }).isVisible()) {
      break;
    }

    await expect(page.getByRole('dialog', { name: 'Столкновение', exact: true })).not.toBeVisible();

    const world = await page.evaluate(() => window.cityTest.world());

    const vehicle = world.vehicle;

    if (vehicle.x < 144) {
      break;
    }

    const waiting = yieldFirst && world.tick < 800 && vehicle.y < 174;

    let x = 163.5;

    let y = vehicle.y - 5;

    if (vehicle.y <= 174) {
      const angle = Math.atan2(vehicle.y - 174, vehicle.x - 146) - 0.15;

      x = 146 + 17.5 * Math.cos(angle);
      y = 174 + 17.5 * Math.sin(angle);
    }

    if (vehicle.x < 148) {
      x = 100;
      y = 156.5;
    }

    const target = Math.atan2(y - vehicle.y, x - vehicle.x);

    const difference = Math.atan2(
      Math.sin(target - vehicle.heading),
      Math.cos(target - vehicle.heading),
    );

    const keys = new Set<string>();

    if (waiting) {
      keys.add('Space');
    } else {
      if (vehicle.speed < 4) {
        keys.add('KeyW');
      }

      if (Math.abs(difference) > 0.03) {
        keys.add(difference < 0 ? 'KeyA' : 'KeyD');
      }
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
    await page.waitForTimeout(40);
  }

  for (const key of held) {
    await page.keyboard.up(key);
  }
}

export async function driveAcrossUnregulatedRoad(
  page: Page,
  yieldFirst: boolean,
  direction: 'south' | 'east',
) {
  let held = new Set<string>();

  for (let iteration = 0; iteration < 1000; iteration++) {
    const world = await page.evaluate(() => window.cityTest.world());

    const snapshot = await page.evaluate(() => window.cityTest.snapshot());

    expect(snapshot.collision).toBeNull();

    const progress = direction === 'south' ? world.vehicle.y : world.vehicle.x;

    const exit = direction === 'south' ? 60 : 300;

    const waitBefore = direction === 'south' ? 19 : 259;

    if (snapshot.current || progress > exit) {
      break;
    }

    const waiting = yieldFirst && world.tick < 850 && progress > waitBefore;

    const keys = new Set<string>();

    if (waiting) {
      keys.add('Space');
    } else if (world.vehicle.speed < 4) {
      keys.add('KeyW');
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
    await page.waitForTimeout(40);
  }

  for (const key of held) {
    await page.keyboard.up(key);
  }
}
