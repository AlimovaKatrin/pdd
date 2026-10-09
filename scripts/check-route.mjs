// Start Vite first. Diagnostic keyboard loop; pose is read from the rendered car colors.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  await page.locator('#road').focus();

  const waypoints = [
    [67.5, 50],
    [24, 50],
    [24, 84],
    [64, 84],
    [67.5, 70],
  ];

  const reached = [];

  let index = 0;

  let held = new Set();

  let incidents = 0;

  for (let frame = 0; frame < 1100 && index < waypoints.length; frame++) {
    if (await page.getByRole('dialog').isVisible()) {
      for (const key of held) {
        await page.keyboard.up(key);
      }

      held.clear();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      incidents++;
    }

    const pose = await page.locator('canvas').evaluate((canvas) => {
      const context = canvas.getContext('2d');

      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

      let bx = 0;

      let by = 0;

      let bn = 0;

      let hx = 0;

      let hy = 0;

      let hn = 0;

      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % canvas.width;

        const y = Math.floor(i / 4 / canvas.width);

        if (data[i] === 52 && data[i + 1] === 120 && data[i + 2] === 196) {
          bx += x;
          by += y;
          bn++;
        }

        if (data[i] === 251 && data[i + 1] === 243 && data[i + 2] === 206) {
          hx += x;
          hy += y;
          hn++;
        }
      }

      return {
        x: bx / bn / 8,
        y: by / bn / 8,
        heading: Math.atan2(hy / hn - by / bn, hx / hn - bx / bn),
      };
    });

    const [x, y] = waypoints[index];

    const distance = Math.hypot(x - pose.x, y - pose.y);

    if (distance < 4) {
      reached.push({ ...pose, target: index });
      console.log(JSON.stringify({ reached: index, pose }));
      index++;
      continue;
    }

    const desired = Math.atan2(y - pose.y, x - pose.x);

    const delta = Math.atan2(Math.sin(desired - pose.heading), Math.cos(desired - pose.heading));

    const speed = Number(await page.getByTestId('speed').textContent());

    const keys = new Set([speed > 17 ? 'Space' : 'KeyW']);

    if (Math.abs(delta) > 0.065) {
      keys.add(delta > 0 ? 'KeyD' : 'KeyA');

      const side = delta > 0 ? 'Правый поворотник' : 'Левый поворотник';

      if (
        Math.abs(delta) > 0.3 &&
        (await page.getByRole('button', { name: side }).getAttribute('aria-pressed')) !== 'true'
      ) {
        await page.keyboard.press(delta > 0 ? 'KeyE' : 'KeyQ');
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
    await page.waitForTimeout(80);
  }

  for (const key of held) {
    await page.keyboard.up(key);
  }

  await page.keyboard.down('Space');
  await page.waitForTimeout(600);
  await page.keyboard.up('Space');
  await page.screenshot({ path: 'test-results/city-route-return.png' });
  console.log(JSON.stringify({ completed: index === waypoints.length, reached, incidents }));

  if (index !== waypoints.length) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
