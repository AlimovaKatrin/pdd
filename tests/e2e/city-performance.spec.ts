import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { cityJournal } from '../fixtures/city-journal';
import { loadJournalFixture } from './journal-fixture';

test('ten-minute browser route measures simulation, frames, history and retained memory', async ({
  page,
  browserName,
}) => {
  const durationSeconds = Number(process.env.PDD_PERF_SECONDS ?? 600);

  const pageErrors: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  test.setTimeout((durationSeconds + 120) * 1000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadJournalFixture(page, cityJournal(1000), '/tests/e2e/performance-harness.html');
  await page.getByRole('button', { name: 'К поездке', exact: true }).click();

  await page.getByRole('button', { name: 'Пауза', exact: true }).click();

  const client = await page.context().newCDPSession(page);

  await client.send('Performance.enable');

  async function metrics() {
    await client.send('HeapProfiler.collectGarbage');

    await client.send('HeapProfiler.collectGarbage');

    const result = await client.send('Performance.getMetrics');

    return Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]));
  }

  console.info('Performance baseline');

  await page.evaluate(() => window.cityPerf.remount());
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.waitForTimeout(300);

  const baseline = await metrics();

  const initial = await page.evaluate(() => window.cityPerf.world());

  await page.getByRole('button', { name: 'Продолжить поездку', exact: true }).click();

  const started = Date.now();

  const checkpoints: { seconds: number; routePoints: number; metrics: Record<string, number> }[] =
    [];

  const journalTimes: number[] = [];

  const points = [
    [163.5, 160],
    [40, 156.5],
    [43.5, 40],
    [160, 43.5],
    [156.5, 280],
    [40, 276.5],
    [43.5, 160],
    [280, 163.5],
    [276.5, 280],
    [160, 276.5],
  ];

  let target = 0;

  let visited = 0;

  let nextSample = 60000;

  let maximumCars = 0;

  let outsideCameraMoved = false;

  let drivenMeters = 0;

  let previousPose = initial.vehicle;

  let previousRelocation = initial.relocation;

  let stoppedSince = 0;

  const safeReturns: { seconds: number; x: number; y: number }[] = [];

  let held = new Set<string>();

  async function releaseKeys() {
    for (const key of held) {
      await page.keyboard.up(key);
    }

    held = new Set();
  }

  while (Date.now() - started < durationSeconds * 1000) {
    const snapshot = await page.evaluate(() => {
      const state = window.cityPerf.snapshot();

      return { collision: !!state.collision, current: !!state.current };
    });

    if (snapshot.collision) {
      await releaseKeys();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Вернуться на дорогу', exact: true })
        .click();
      target = 0;
      continue;
    }

    if (snapshot.current) {
      await releaseKeys();

      if (await page.getByRole('button', { name: 'Продолжить', exact: true }).isVisible()) {
        await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      }

      continue;
    }

    if (Date.now() - started >= nextSample) {
      console.info('Performance checkpoint', nextSample / 1000, visited);
      await releaseKeys();

      const openStart = Date.now();

      await page.getByRole('button', { name: /^Журнал/ }).click();
      await expect(page.locator('.journal-list > button').first()).toBeVisible();
      journalTimes.push(Date.now() - openStart);
      await page.locator('.journal-list > button').last().click();
      await page.getByRole('button', { name: 'Назад в журнал' }).click();
      await page.getByRole('button', { name: 'К поездке', exact: true }).click();
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));

      const paused = await page.evaluate(() => window.cityPerf.world());

      await page.waitForTimeout(300);
      expect(await page.evaluate(() => window.cityPerf.world())).toEqual(paused);
      await page.getByRole('button', { name: 'Продолжить поездку', exact: true }).click();
      checkpoints.push({
        seconds: (Date.now() - started) / 1000,
        routePoints: visited,
        metrics: await metrics(),
      });
      await writeFile(
        '/tmp/pdd-performance-progress.json',
        JSON.stringify(
          {
            checkpoints,
            journalTimes,
            visited,
            drivenMeters,
            safeReturns,
            pose: await page.evaluate(() => window.cityPerf.world().vehicle),
            observations: await page.evaluate(() => window.cityPerf.read()),
          },
          null,
          2,
        ),
      );
      await page.evaluate(() => window.cityPerf.remount());
      await expect(page.locator('canvas')).toHaveCount(1);
      expect(await page.evaluate(() => window.cityPerf.read().activeWorlds)).toBe(1);
      nextSample += 60000;
    }

    const world = await page.evaluate(() => window.cityPerf.world());

    maximumCars = Math.max(maximumCars, world.traffic.vehicles.length);
    outsideCameraMoved ||= world.traffic.vehicles.some((car) => {
      const old = initial.traffic.vehicles.find((item) => item.id === car.id);

      return (
        old &&
        Math.hypot(car.vehicle.x - world.vehicle.x, car.vehicle.y - world.vehicle.y) > 100 &&
        Math.hypot(car.vehicle.x - old.vehicle.x, car.vehicle.y - old.vehicle.y) > 10
      );
    });

    const pose = world.vehicle;

    if (world.relocation === previousRelocation) {
      drivenMeters += Math.hypot(pose.x - previousPose.x, pose.y - previousPose.y);
    }

    previousPose = pose;
    previousRelocation = world.relocation;
    stoppedSince = pose.speed < 0.05 ? stoppedSince || Date.now() : 0;

    if (stoppedSince && Date.now() - stoppedSince > 20000) {
      await releaseKeys();
      safeReturns.push({ seconds: (Date.now() - started) / 1000, x: pose.x, y: pose.y });
      await page.getByRole('button', { name: 'Вернуться на дорогу', exact: true }).click();

      const returned = await page.evaluate(() => window.cityPerf.world().vehicle);

      // Resume along the nearest forward segment instead of steering across the city.
      const candidates = points.map(([endX, endY], index) => {
        const [startX, startY] = points[(index + points.length - 1) % points.length];

        const dx = endX - startX;

        const dy = endY - startY;

        const ratio = Math.max(
          0,
          Math.min(
            1,
            ((returned.x - startX) * dx + (returned.y - startY) * dy) / (dx * dx + dy * dy),
          ),
        );

        const alignment =
          (dx * Math.cos(returned.heading) + dy * Math.sin(returned.heading)) / Math.hypot(dx, dy);

        return {
          index,
          distance:
            Math.hypot(returned.x - startX - ratio * dx, returned.y - startY - ratio * dy) +
            (alignment < 0.5 ? 1000 : 0),
        };
      });

      target = candidates.sort((a, b) => a.distance - b.distance)[0].index;
      stoppedSince = 0;
      continue;
    }

    const [x, y] = points[target];

    if (Math.hypot(x - pose.x, y - pose.y) < 5) {
      visited++;
      target = (target + 1) % points.length;
      continue;
    }

    const desired = Math.atan2(y - pose.y, x - pose.x);

    const angle = Math.atan2(Math.sin(desired - pose.heading), Math.cos(desired - pose.heading));

    const blocked = world.traffic.vehicles.some(({ vehicle }) => {
      const dx = vehicle.x - pose.x;

      const dy = vehicle.y - pose.y;

      return (
        dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading) > 0 &&
        dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading) < 12 &&
        Math.abs(-dx * Math.sin(pose.heading) + dy * Math.cos(pose.heading)) < 2.5
      );
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
    await page.waitForTimeout(80);
  }

  await releaseKeys();
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();

  console.info('Performance final');

  const final = await metrics();

  const observations = await page.evaluate(() => ({
    ...window.cityPerf.read(),
    tick: window.cityPerf.world().tick,
    history: window.cityPerf.snapshot().history.violations.length,
    userAgent: navigator.userAgent,
  }));

  await page.evaluate(() => window.cityPerf.dispose());
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => window.cityPerf.read().activeWorlds)).toBe(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.cityPerf.read().steps.count)).toBe(
    observations.steps.count,
  );

  const report = {
    durationSeconds,
    browserName,
    visited,
    maximumCars,
    outsideCameraMoved,
    baseline,
    final,
    checkpoints,
    journalTimes,
    pageErrors,
    drivenMeters,
    safeReturns,
    ...observations,
  };

  await writeFile('/tmp/pdd-performance-result.json', JSON.stringify(report, null, 2));
  expect(pageErrors).toEqual([]);
  expect(maximumCars).toBeLessThanOrEqual(8);
  expect(outsideCameraMoved).toBe(true);
  expect(observations.steps.p95).toBeLessThan(8);
  expect(observations.frames.p95).toBeLessThan(34);
  expect(final.JSHeapUsedSize - baseline.JSHeapUsedSize).toBeLessThan(20 * 1024 * 1024);
  expect(final.Nodes - baseline.Nodes).toBeLessThan(200);
  expect(observations.history).toBeGreaterThanOrEqual(1000);
  expect(drivenMeters).toBeGreaterThan(durationSeconds >= 600 ? 1500 : 10);
  expect(journalTimes.length).toBeGreaterThanOrEqual(
    Math.max(0, Math.floor(durationSeconds / 60) - 1),
  );
  expect(journalTimes.every((milliseconds) => milliseconds < 1000)).toBe(true);
});
