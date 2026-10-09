// Start `npm run dev` first. This measures the configured development map in Chromium.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { arch, cpus, platform } from 'node:os';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Поехать в город', exact: true }).click();
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('HeapProfiler.collectGarbage');
  const heap = async () =>
    (await client.send('Performance.getMetrics')).metrics.find((m) => m.name === 'JSHeapUsedSize')
      .value;
  const before = await heap();
  const simulation = await page.evaluate(async () => {
    const { stepWorld } = await import('/src/domain/simulation/step.ts');
    const { initialWorld, emptyControls } = await import('/src/domain/world/model.ts');
    const { neighborhood } = await import('/src/content/maps/neighborhood.ts');
    let world = initialWorld(neighborhood);
    const samples = [],
      controls = { ...emptyControls(), throttle: true };
    for (let batch = 0; batch < 1000; batch++) {
      const start = performance.now();
      for (let tick = 0; tick < 60; tick++) {
        world = stepWorld(world, controls, neighborhood).world;
      }
      samples.push((performance.now() - start) / 60);
    }
    samples.sort((a, b) => a - b);
    return {
      steps: 60000,
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p95BatchAverageMs: samples[Math.floor(samples.length * 0.95)],
      tick: world.tick,
    };
  });
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const values = [];
        let previous = performance.now();
        const frame = (now) => {
          values.push(now - previous);
          previous = now;
          if (values.length < 180) {
            globalThis.requestAnimationFrame(frame);
          } else {
            values.shift();
            values.sort((a, b) => a - b);
            resolve({
              samples: values.length,
              medianMs: values[Math.floor(values.length / 2)],
              p95Ms: values[Math.floor(values.length * 0.95)],
            });
          }
        };
        globalThis.requestAnimationFrame(frame);
      }),
  );
  await client.send('HeapProfiler.collectGarbage');
  const after = await heap();
  const result = {
    measuredAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      browser: browser.version(),
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0].model,
      viewport: '1280x720',
      build: 'Vite development, headless Chromium, one map',
    },
    budgets: { simulationP95BatchAverageMs: 1, frameP95Ms: 33.4, heapMiB: 128 },
    simulation,
    frames,
    heap: { beforeMiB: before / 1048576, afterMiB: after / 1048576 },
    limitations:
      'Local diagnostic, not a cross-device performance guarantee. Frame timing includes browser scheduling; heap includes Phaser and development runtime.',
  };
  await writeFile('docs/implementation/performance.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
