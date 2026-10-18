import type Phaser from 'phaser';
import type { RoadMap } from '../../domain/world/model';
import type { ReadonlyData } from '../../domain/world/read-only';
import { SIDE_VECTOR } from '../../domain/world/road-network';
import { addMapLabel, PIXELS_PER_METER as SCALE } from './city-drawing';

export function drawNetworkScenery(
  scene: Phaser.Scene,
  graphics: Phaser.GameObjects.Graphics,
  map: ReadonlyData<RoadMap>,
) {
  const network = map.network;

  if (!network) {
    return;
  }

  graphics.fillStyle(0xdce5d5);
  graphics.fillRect(0, 0, map.width * SCALE, map.height * SCALE);

  for (const road of map.roads) {
    graphics.fillStyle(0xe7e9dc);
    graphics.fillRoundedRect(
      (road.x - 2) * SCALE,
      (road.y - 2) * SCALE,
      (road.width + 4) * SCALE,
      (road.height + 4) * SCALE,
      16,
    );
  }

  for (const road of map.roads) {
    graphics.fillStyle(0xa8b6ae);
    graphics.fillRect(road.x * SCALE, road.y * SCALE, road.width * SCALE, road.height * SCALE);
  }

  for (const boundary of network.boundaries) {
    graphics.lineStyle(2, 0xf7f3df);

    const heading = Math.atan2(boundary.to.y - boundary.from.y, boundary.to.x - boundary.from.x);

    const offsets = boundary.marking === 'double-solid' ? [-0.22, 0.22] : [0];

    for (const offset of offsets) {
      const x = -Math.sin(heading) * offset;

      const y = Math.cos(heading) * offset;

      graphics.lineBetween(
        (boundary.from.x + x) * SCALE,
        (boundary.from.y + y) * SCALE,
        (boundary.to.x + x) * SCALE,
        (boundary.to.y + y) * SCALE,
      );
    }
  }

  const xs = [...new Set(network.junctions.map((junction) => junction.x))].sort((a, b) => a - b);

  const ys = [...new Set(network.junctions.map((junction) => junction.y))].sort((a, b) => a - b);

  const labels = ['Сад', 'Мастерские', 'Парк', 'Площадь'];

  for (let row = 1; row < ys.length; row++) {
    for (let column = 1; column < xs.length; column++) {
      const x = (xs[column - 1] + xs[column]) / 2;

      const y = (ys[row - 1] + ys[row]) / 2;

      graphics.fillStyle(0xc4d5b8);
      graphics.fillRoundedRect((x - 35) * SCALE, (y - 35) * SCALE, 70 * SCALE, 70 * SCALE, 32);
      addMapLabel(
        scene,
        x * SCALE,
        y * SCALE,
        labels[(row - 1) * 2 + column - 1] ?? 'Квартал',
        '#647c60',
        24,
      );

      for (const [dx, dy] of [
        [-25, -24],
        [25, -24],
        [-25, 24],
        [25, 24],
      ]) {
        graphics.fillStyle(0x8faa85);
        graphics.fillCircle((x + dx) * SCALE, (y + dy) * SCALE, 24);
        graphics.fillStyle(0xa4bd95);
        graphics.fillCircle((x + dx - 1) * SCALE, (y + dy - 1) * SCALE, 18);
      }
    }
  }

  for (const junction of network.junctions) {
    for (const approach of junction.approaches) {
      const lane = network.lanes.find((item) => item.id === approach.incomingLaneId)!;

      const outward = SIDE_VECTOR[approach.side];

      const x = (lane.to.x + outward.x * 3 + outward.y * 6) * SCALE;

      const y = (lane.to.y + outward.y * 3 - outward.x * 6) * SCALE;

      if (approach.sign === 'main') {
        const diamond = [
          { x, y: y - 14 },
          { x: x + 14, y },
          { x, y: y + 14 },
          { x: x - 14, y },
        ];

        graphics.fillStyle(0xf7cb51);
        graphics.fillPoints(diamond, true);
        graphics.lineStyle(3, 0xffffff);
        graphics.strokePoints(diamond, true);
      }

      if (approach.sign === 'yield') {
        const triangle = [
          { x: x - 14, y: y - 10 },
          { x: x + 14, y: y - 10 },
          { x, y: y + 14 },
        ];

        graphics.fillStyle(0xfffbf2);
        graphics.fillPoints(triangle, true);
        graphics.lineStyle(3, 0xb94a42);
        graphics.strokePoints(triangle, true);
      }
    }
  }
}
