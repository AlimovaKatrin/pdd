import type { ReadonlyData } from '../../domain/world/read-only';
import type Phaser from 'phaser';
import type { RoadMap } from '../../domain/world/model';
import { addMapLabel, PIXELS_PER_METER } from './city-drawing';

export function drawRoadFeatures(
  scene: Phaser.Scene,
  graphics: Phaser.GameObjects.Graphics,
  map: ReadonlyData<RoadMap>,
) {
  for (const zone of map.speedZones ?? []) {
    const x = zone.sign.x * PIXELS_PER_METER;

    const y = zone.sign.y * PIXELS_PER_METER + 14;

    graphics.fillStyle(0xfafbf5);
    graphics.fillCircle(x, y, 13);
    graphics.lineStyle(3, 0xba493f);
    graphics.strokeCircle(x, y, 13);
    addMapLabel(scene, x, y, String(zone.limit), '#253e34', 13);
    addMapLabel(scene, x + 24, y, '→', '#253e34', 16);
  }

  for (const crossing of map.crossings ?? []) {
    graphics.fillStyle(0xf4f0dd);

    for (
      let x = Math.min(crossing.from.x, crossing.to.x);
      x < Math.max(crossing.from.x, crossing.to.x);
      x += 1.5
    ) {
      graphics.fillRect(
        x * PIXELS_PER_METER,
        (crossing.from.y - 1.5) * PIXELS_PER_METER,
        0.8 * PIXELS_PER_METER,
        3 * PIXELS_PER_METER,
      );
    }

    addMapLabel(
      scene,
      crossing.to.x * PIXELS_PER_METER + 18,
      crossing.to.y * PIXELS_PER_METER,
      'ПЕШЕХОД',
      '#253e34',
      8,
    );
  }

  for (const signal of map.signals ?? []) {
    graphics.lineStyle(4, 0xf4f0dd);
    graphics.lineBetween(
      signal.line.a.x * PIXELS_PER_METER,
      signal.line.a.y * PIXELS_PER_METER,
      signal.line.b.x * PIXELS_PER_METER,
      signal.line.b.y * PIXELS_PER_METER,
    );
  }
}

export function drawStopSigns(
  scene: Phaser.Scene,
  graphics: Phaser.GameObjects.Graphics,
  map: ReadonlyData<RoadMap>,
) {
  for (const stop of map.stops) {
    graphics.lineStyle(4, 0xf4f0dd);
    graphics.lineBetween(
      stop.a.x * PIXELS_PER_METER,
      stop.a.y * PIXELS_PER_METER,
      stop.b.x * PIXELS_PER_METER,
      stop.b.y * PIXELS_PER_METER,
    );
    addMapLabel(
      scene,
      (stop.a.x + 3.5) * PIXELS_PER_METER,
      (stop.a.y + 4) * PIXELS_PER_METER,
      'STOP',
      '#f6f2e7',
      12,
    );

    const signX = (stop.b.x + 2.7) * PIXELS_PER_METER;

    const signY = (stop.b.y + 1) * PIXELS_PER_METER;

    graphics.fillStyle(0x475f52, 0.18);
    graphics.fillEllipse(signX + 3, signY + 7, 31, 17);

    const octagon = Array.from({ length: 8 }, (_, i) => ({
      x: signX + Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * 14,
      y: signY + Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * 14,
    }));

    graphics.fillStyle(0xc55649);
    graphics.fillPoints(octagon, true);
    graphics.lineStyle(2, 0xfff8e8);
    graphics.strokePoints(octagon, true);
    addMapLabel(scene, signX, signY, 'STOP', '#ffffff', 7);
  }
}

export function drawSpawnMarker(graphics: Phaser.GameObjects.Graphics, map: ReadonlyData<RoadMap>) {
  const spawn = map.spawn;

  graphics.lineStyle(1, 0xdae4d4, 0.55);
  graphics.strokeCircle(spawn.x * PIXELS_PER_METER, spawn.y * PIXELS_PER_METER, 27);
}
