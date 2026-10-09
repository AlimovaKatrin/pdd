import type { ReadonlyData } from '../../domain/world/read-only';
import type Phaser from 'phaser';
import type {
  Crossing,
  PedestrianState,
  RoadMap,
  TrafficSignal,
  World,
} from '../../domain/world/model';
import { signalColor } from '../../domain/world/traffic';
import { PIXELS_PER_METER } from './city-drawing';

const SIGNAL_LAMPS = [
  { color: 'red', fill: 0xff574d },
  { color: 'yellow', fill: 0xffd35c },
  { color: 'green', fill: 0x82d99a },
] as const;

export function drawTraffic(
  graphics: Phaser.GameObjects.Graphics,
  map: ReadonlyData<RoadMap>,
  world: ReadonlyData<World>,
) {
  graphics.clear();

  for (const signal of map.signals ?? []) {
    drawTrafficSignal(graphics, signal, world.tick);
  }

  for (const crossing of map.crossings ?? []) {
    drawPedestrian(graphics, crossing, world.pedestrians[crossing.id]);
  }
}

function drawPedestrian(
  graphics: Phaser.GameObjects.Graphics,
  crossing: Crossing,
  pedestrian: PedestrianState,
) {
  const x =
    (crossing.from.x + (crossing.to.x - crossing.from.x) * pedestrian.progress) * PIXELS_PER_METER;

  const y =
    (crossing.from.y + (crossing.to.y - crossing.from.y) * pedestrian.progress) * PIXELS_PER_METER;

  graphics.fillStyle(0xfafbf5);
  graphics.fillCircle(x, y, 7);
  graphics.fillStyle(pedestrian.reaction ? 0xb7483e : 0x304e83);
  graphics.fillCircle(x, y, 5);
  graphics.fillStyle(0xf4ca9e);
  graphics.fillCircle(x, y - 2, 2.8);
}

function drawTrafficSignal(
  graphics: Phaser.GameObjects.Graphics,
  signal: ReadonlyData<TrafficSignal>,
  tick: number,
) {
  const color = signalColor(signal, tick);

  const x = signal.line.b.x * PIXELS_PER_METER + 12;

  const y = signal.line.b.y * PIXELS_PER_METER;

  graphics.fillStyle(0x263b33);
  graphics.fillRoundedRect(x - 7, y - 22, 14, 44, 5);

  for (const [index, lamp] of SIGNAL_LAMPS.entries()) {
    const isLit = color === lamp.color || (color === 'red-yellow' && lamp.color !== 'green');

    graphics.fillStyle(isLit ? lamp.fill : 0x51655b);
    graphics.fillCircle(x, y - 13 + index * 13, 4.5);
  }
}
