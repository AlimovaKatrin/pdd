import type { ReadonlyData } from '../../domain/world/read-only';
import type Phaser from 'phaser';
import type { Road, RoadMap } from '../../domain/world/model';
import { addMapLabel, CANVAS_HEIGHT, CANVAS_WIDTH, PIXELS_PER_METER } from './city-drawing';

// Decorative layout for the current neighborhood; it does not define driving rules.
const VERTICAL_ROAD_CENTERS = [24, 64, 104];

const HORIZONTAL_ROAD_CENTERS = [18, 50, 84];

export function drawCityScenery(
  scene: Phaser.Scene,
  graphics: Phaser.GameObjects.Graphics,
  map: ReadonlyData<RoadMap>,
) {
  drawGround(graphics);
  drawRoads(graphics, map.roads);
  drawLaneMarkings(graphics);
  drawNeighborhoodDecorations(graphics);
  addMapLabel(scene, 351, 324, 'ЖИЛОЙ КВАРТАЛ');
  addMapLabel(scene, 673, 308, 'КОФЕЙНЯ');
  addMapLabel(scene, 402, 624, 'СКВЕР');
  addMapLabel(scene, 685, 621, 'МАСТЕРСКАЯ');
  addMapLabel(scene, 355, 400, 'САДОВАЯ УЛИЦА', '#d7dfd7');
  addMapLabel(scene, 685, 672, 'ТИХИЙ ПРОЕЗД', '#d7dfd7');
}

function drawGround(graphics: Phaser.GameObjects.Graphics) {
  graphics.fillStyle(0xdce5d5);
  graphics.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Fine lawn pattern, deterministic and entirely decorative.
  for (let x = 8; x < CANVAS_WIDTH; x += 19) {
    for (let y = 8; y < CANVAS_HEIGHT; y += 19) {
      graphics.fillStyle(0xc9d6c3, 0.6);
      graphics.fillCircle(x, y, 0.8);
    }
  }
}

function drawRoads(graphics: Phaser.GameObjects.Graphics, roads: readonly Road[]) {
  for (const road of roads) {
    graphics.fillStyle(0xc6ccbc);
    graphics.fillRoundedRect(
      road.x * PIXELS_PER_METER - 6,
      road.y * PIXELS_PER_METER - 6,
      road.width * PIXELS_PER_METER + 12,
      road.height * PIXELS_PER_METER + 12,
      8,
    );
  }

  for (const road of roads) {
    graphics.fillStyle(0x737e7c);
    graphics.fillRect(
      road.x * PIXELS_PER_METER,
      road.y * PIXELS_PER_METER,
      road.width * PIXELS_PER_METER,
      road.height * PIXELS_PER_METER,
    );
  }
}

function drawLaneMarkings(graphics: Phaser.GameObjects.Graphics) {
  graphics.lineStyle(1.5, 0xe0e4d7, 0.75);

  for (const x of VERTICAL_ROAD_CENTERS) {
    for (let y = 13; y < 90; y += 3) {
      if (HORIZONTAL_ROAD_CENTERS.some((center) => Math.abs(y - center) < 8)) {
        continue;
      }

      graphics.lineBetween(
        x * PIXELS_PER_METER,
        y * PIXELS_PER_METER,
        x * PIXELS_PER_METER,
        (y + 1.5) * PIXELS_PER_METER,
      );
    }
  }

  for (const y of HORIZONTAL_ROAD_CENTERS) {
    for (let x = 19; x < 109; x += 3) {
      if (VERTICAL_ROAD_CENTERS.some((center) => Math.abs(x - center) < 8)) {
        continue;
      }

      graphics.lineBetween(
        x * PIXELS_PER_METER,
        y * PIXELS_PER_METER,
        (x + 1.5) * PIXELS_PER_METER,
        y * PIXELS_PER_METER,
      );
    }
  }
}

function drawTree(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number) {
  graphics.fillStyle(0x324e3d, 0.16);
  graphics.fillEllipse(x + 4, y + 6, size * 2, size * 1.7);
  graphics.fillStyle(0x86a486);
  graphics.fillCircle(x, y, size);
  graphics.fillStyle(0x9bb597);
  graphics.fillCircle(x - size * 0.25, y - size * 0.25, size * 0.7);
  graphics.fillStyle(0xb3c5a4, 0.7);
  graphics.fillCircle(x - size * 0.32, y - size * 0.38, size * 0.28);
}

function drawBuilding(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
) {
  graphics.fillStyle(0x536759, 0.18);
  graphics.fillRoundedRect(x + 6, y + 7, width, height, 5);
  graphics.fillStyle(0xf0eee4);
  graphics.fillRoundedRect(x - 3, y - 3, width + 6, height + 6, 5);
  graphics.fillStyle(color);
  graphics.fillRoundedRect(x, y, width, height, 3);
  graphics.lineStyle(2, 0xffffff, 0.35);
  graphics.strokeRect(x + 5, y + 5, width - 10, height - 10);
  graphics.fillStyle(0x7a8984, 0.6);
  graphics.fillRect(x + width / 2 - 7, y + 10, 14, 8);
  graphics.fillStyle(0x576d65, 0.15);
  graphics.fillRect(x + 9, y + height - 14, width - 18, 4);
}

function drawNeighborhoodDecorations(graphics: Phaser.GameObjects.Graphics) {
  drawBuilding(graphics, 285, 234, 70, 73, 0xc5b9a7);
  drawBuilding(graphics, 373, 231, 53, 77, 0xb8c6c2);
  drawBuilding(graphics, 615, 224, 116, 69, 0xd4baa5);
  drawBuilding(graphics, 619, 542, 71, 54, 0xb9c6bd);
  drawBuilding(graphics, 710, 534, 43, 69, 0xc7bdaa);
  drawBuilding(graphics, 283, 507, 76, 87, 0xcebda9);
  // Pocket park and footpaths.
  graphics.fillStyle(0xe8e4d4);
  graphics.fillRoundedRect(385, 505, 16, 96, 6);
  graphics.fillRoundedRect(378, 547, 67, 12, 5);
  graphics.fillStyle(0xb0c3ad);
  graphics.fillCircle(429, 527, 23);
  graphics.fillStyle(0xcad8c6);
  graphics.fillCircle(429, 527, 16);

  for (const [x, y, radius] of [
    [82, 155, 18],
    [89, 318, 21],
    [87, 498, 16],
    [90, 631, 20],
    [283, 336, 12],
    [414, 342, 15],
    [451, 264, 14],
    [436, 590, 13],
    [415, 488, 14],
    [286, 625, 13],
    [737, 324, 17],
    [613, 329, 14],
    [747, 628, 15],
    [903, 251, 18],
    [900, 459, 19],
    [896, 653, 20],
    [360, 62, 13],
    [641, 54, 16],
    [416, 755, 15],
    [715, 751, 18],
  ]) {
    drawTree(graphics, x, y, radius);
  }
}
