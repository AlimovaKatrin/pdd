import type Phaser from 'phaser';
import type { Point, Vehicle } from '../../domain/world/model';
import { PIXELS_PER_METER } from './city-drawing';

const VEHICLE_VISUAL_SCALE = 1.1;

const INDICATOR_HALF_PERIOD_TICKS = 20;

export function createVehicleView(scene: Phaser.Scene, spawn: Point) {
  const body = scene.add.graphics();

  // The car is drawn in local pixels; its world position is applied below.
  // Shadow and body.
  body.fillStyle(0x243f36, 0.2);
  body.fillRoundedRect(-15, -7, 35, 17, 6);
  body.fillStyle(0x3478c4);
  body.fillRoundedRect(-17, -8, 34, 16, 5);
  // Windows.
  body.fillStyle(0x526b68);
  body.fillRoundedRect(-7, -6, 17, 12, 3);
  body.fillStyle(0x89a6a0);
  body.fillRect(5, -5, 4, 10);
  body.fillStyle(0x74a6de);
  body.fillRect(-5, -5, 7, 10);
  // Headlights and rear lights.
  body.fillStyle(0xfbf3ce);
  body.fillRect(14, -6, 3, 3);
  body.fillRect(14, 3, 3, 3);
  body.fillStyle(0xb86247);
  body.fillRect(-17, -6, 2, 3);
  body.fillRect(-17, 3, 2, 3);

  const indicators = scene.add.graphics();

  const container = scene.add
    .container(spawn.x * PIXELS_PER_METER, spawn.y * PIXELS_PER_METER, [body, indicators])
    .setScale(VEHICLE_VISUAL_SCALE);

  return {
    update(vehicle: Vehicle, tick: number) {
      container
        .setPosition(vehicle.x * PIXELS_PER_METER, vehicle.y * PIXELS_PER_METER)
        .setRotation(vehicle.heading);
      indicators.clear();

      const isIndicatorLit = Math.floor(tick / INDICATOR_HALF_PERIOD_TICKS) % 2 === 0;

      if (!vehicle.indicator || !isIndicatorLit) {
        return;
      }

      const indicatorY = vehicle.indicator === 'left' ? -9 : 6;

      indicators.fillStyle(0xffa726);
      indicators.fillRect(12, indicatorY, 4, 3);
      indicators.fillRect(-15, indicatorY, 4, 3);
    },
  };
}
