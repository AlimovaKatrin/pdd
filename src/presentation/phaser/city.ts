import { signalColor } from '../../domain/world/traffic';
import Phaser from 'phaser';
import type { GameSession } from '../../use-cases/session/game-session';
const SCALE = 8;
export function mountCity(parent: HTMLElement, session: GameSession) {
  class CityScene extends Phaser.Scene {
    private car!: Phaser.GameObjects.Container;
    private traffic!: Phaser.GameObjects.Graphics;
    private lamps!: Phaser.GameObjects.Graphics;
    create() {
      const g = this.add.graphics();
      g.fillStyle(0xdce5d5);
      g.fillRect(0, 0, 960, 800);
      // Fine lawn pattern, deterministic and entirely decorative.
      for (let x = 8; x < 960; x += 19) {
        for (let y = 8; y < 800; y += 19) {
          g.fillStyle(0xc9d6c3, 0.6);
          g.fillCircle(x, y, 0.8);
        }
      }
      for (const r of session.map.roads) {
        g.fillStyle(0xc6ccbc);
        g.fillRoundedRect(
          r.x * SCALE - 6,
          r.y * SCALE - 6,
          r.width * SCALE + 12,
          r.height * SCALE + 12,
          8,
        );
      }
      for (const r of session.map.roads) {
        g.fillStyle(0x737e7c);
        g.fillRect(r.x * SCALE, r.y * SCALE, r.width * SCALE, r.height * SCALE);
      }
      g.lineStyle(1.5, 0xe0e4d7, 0.75);
      for (const x of [24, 64, 104]) {
        for (let y = 13; y < 90; y += 3) {
          if ([18, 50, 84].some((c) => Math.abs(y - c) < 8)) {
            continue;
          }
          g.lineBetween(x * SCALE, y * SCALE, x * SCALE, (y + 1.5) * SCALE);
        }
      }
      for (const y of [18, 50, 84]) {
        for (let x = 19; x < 109; x += 3) {
          if ([24, 64, 104].some((c) => Math.abs(x - c) < 8)) {
            continue;
          }
          g.lineBetween(x * SCALE, y * SCALE, (x + 1.5) * SCALE, y * SCALE);
        }
      }
      const tree = (x: number, y: number, size = 15) => {
        g.fillStyle(0x324e3d, 0.16);
        g.fillEllipse(x + 4, y + 6, size * 2, size * 1.7);
        g.fillStyle(0x86a486);
        g.fillCircle(x, y, size);
        g.fillStyle(0x9bb597);
        g.fillCircle(x - size * 0.25, y - size * 0.25, size * 0.7);
        g.fillStyle(0xb3c5a4, 0.7);
        g.fillCircle(x - size * 0.32, y - size * 0.38, size * 0.28);
      };
      const building = (x: number, y: number, w: number, h: number, color: number) => {
        g.fillStyle(0x536759, 0.18);
        g.fillRoundedRect(x + 6, y + 7, w, h, 5);
        g.fillStyle(0xf0eee4);
        g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 5);
        g.fillStyle(color);
        g.fillRoundedRect(x, y, w, h, 3);
        g.lineStyle(2, 0xffffff, 0.35);
        g.strokeRect(x + 5, y + 5, w - 10, h - 10);
        g.fillStyle(0x7a8984, 0.6);
        g.fillRect(x + w / 2 - 7, y + 10, 14, 8);
        g.fillStyle(0x576d65, 0.15);
        g.fillRect(x + 9, y + h - 14, w - 18, 4);
      };
      building(285, 234, 70, 73, 0xc5b9a7);
      building(373, 231, 53, 77, 0xb8c6c2);
      building(615, 224, 116, 69, 0xd4baa5);
      building(619, 542, 71, 54, 0xb9c6bd);
      building(710, 534, 43, 69, 0xc7bdaa);
      building(283, 507, 76, 87, 0xcebda9);
      // Pocket park and footpaths.
      g.fillStyle(0xe8e4d4);
      g.fillRoundedRect(385, 505, 16, 96, 6);
      g.fillRoundedRect(378, 547, 67, 12, 5);
      g.fillStyle(0xb0c3ad);
      g.fillCircle(429, 527, 23);
      g.fillStyle(0xcad8c6);
      g.fillCircle(429, 527, 16);
      for (const [x, y, r] of [
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
        tree(x, y, r);
      }
      const label = (x: number, y: number, text: string, color = '#6d8172', size = 10) =>
        this.add
          .text(x, y, text, {
            fontFamily: 'Arial, sans-serif',
            fontSize: size,
            color,
            letterSpacing: 2,
          })
          .setOrigin(0.5);
      label(351, 324, 'ЖИЛОЙ КВАРТАЛ');
      label(673, 308, 'КОФЕЙНЯ');
      label(402, 624, 'СКВЕР');
      label(685, 621, 'МАСТЕРСКАЯ');
      label(355, 400, 'САДОВАЯ УЛИЦА', '#d7dfd7');
      label(685, 672, 'ТИХИЙ ПРОЕЗД', '#d7dfd7');
      for (const zone of session.map.speedZones ?? []) {
        const x = zone.sign.x * SCALE,
          y = zone.sign.y * SCALE + 14;
        g.fillStyle(0xfafbf5);
        g.fillCircle(x, y, 13);
        g.lineStyle(3, 0xba493f);
        g.strokeCircle(x, y, 13);
        label(x, y, String(zone.limit), '#253e34', 13);
        label(x + 24, y, '→', '#253e34', 16);
      }
      for (const c of session.map.crossings ?? []) {
        g.fillStyle(0xf4f0dd);
        for (let x = Math.min(c.from.x, c.to.x); x < Math.max(c.from.x, c.to.x); x += 1.5) {
          g.fillRect(x * SCALE, (c.from.y - 1.5) * SCALE, 0.8 * SCALE, 3 * SCALE);
        }
        label(c.to.x * SCALE + 18, c.to.y * SCALE, 'ПЕШЕХОД', '#253e34', 8);
      }
      for (const signal of session.map.signals ?? []) {
        g.lineStyle(4, 0xf4f0dd);
        g.lineBetween(
          signal.line.a.x * SCALE,
          signal.line.a.y * SCALE,
          signal.line.b.x * SCALE,
          signal.line.b.y * SCALE,
        );
      }
      this.traffic = this.add.graphics();
      for (const stop of session.map.stops) {
        g.lineStyle(4, 0xf4f0dd);
        g.lineBetween(stop.a.x * SCALE, stop.a.y * SCALE, stop.b.x * SCALE, stop.b.y * SCALE);
        label((stop.a.x + 3.5) * SCALE, (stop.a.y + 4) * SCALE, 'STOP', '#f6f2e7', 12);
        const sx = (stop.b.x + 2.7) * SCALE,
          sy = (stop.b.y + 1) * SCALE;
        g.fillStyle(0x475f52, 0.18);
        g.fillEllipse(sx + 3, sy + 7, 31, 17);
        const octagon = Array.from({ length: 8 }, (_, i) => ({
          x: sx + Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * 14,
          y: sy + Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * 14,
        }));
        g.fillStyle(0xc55649);
        g.fillPoints(octagon, true);
        g.lineStyle(2, 0xfff8e8);
        g.strokePoints(octagon, true);
        label(sx, sy, 'STOP', '#ffffff', 7);
      }
      const spawn = session.map.spawn;
      g.lineStyle(1, 0xdae4d4, 0.55);
      g.strokeCircle(spawn.x * SCALE, spawn.y * SCALE, 27);
      const body = this.add.graphics();
      body.fillStyle(0x243f36, 0.2);
      body.fillRoundedRect(-15, -7, 35, 17, 6);
      body.fillStyle(0x3478c4);
      body.fillRoundedRect(-17, -8, 34, 16, 5);
      body.fillStyle(0x526b68);
      body.fillRoundedRect(-7, -6, 17, 12, 3);
      body.fillStyle(0x89a6a0);
      body.fillRect(5, -5, 4, 10);
      body.fillStyle(0x74a6de);
      body.fillRect(-5, -5, 7, 10);
      body.fillStyle(0xfbf3ce);
      body.fillRect(14, -6, 3, 3);
      body.fillRect(14, 3, 3, 3);
      body.fillStyle(0xb86247);
      body.fillRect(-17, -6, 2, 3);
      body.fillRect(-17, 3, 2, 3);
      this.lamps = this.add.graphics();
      this.car = this.add
        .container(spawn.x * SCALE, spawn.y * SCALE, [body, this.lamps])
        .setScale(1.1);
    }
    update() {
      if (!this.car) {
        return;
      }
      const world = session.getWorld(),
        car = world.vehicle;
      this.traffic.clear();
      for (const signal of session.map.signals ?? []) {
        const color = signalColor(signal, world.tick),
          x = signal.line.b.x * SCALE + 12,
          y = signal.line.b.y * SCALE;
        this.traffic.fillStyle(0x263b33);
        this.traffic.fillRoundedRect(x - 7, y - 22, 14, 44, 5);
        for (const [i, lamp] of ['red', 'yellow', 'green'].entries()) {
          const active = color === lamp || (color === 'red-yellow' && lamp !== 'green');
          this.traffic.fillStyle(
            active
              ? lamp === 'red'
                ? 0xff574d
                : lamp === 'yellow'
                  ? 0xffd35c
                  : 0x82d99a
              : 0x51655b,
          );
          this.traffic.fillCircle(x, y - 13 + i * 13, 4.5);
        }
      }
      for (const c of session.map.crossings ?? []) {
        const p = world.pedestrians[c.id];
        const x = (c.from.x + (c.to.x - c.from.x) * p.progress) * SCALE,
          y = (c.from.y + (c.to.y - c.from.y) * p.progress) * SCALE;
        this.traffic.fillStyle(0xfafbf5);
        this.traffic.fillCircle(x, y, 7);
        this.traffic.fillStyle(p.reaction ? 0xb7483e : 0x304e83);
        this.traffic.fillCircle(x, y, 5);
        this.traffic.fillStyle(0xf4ca9e);
        this.traffic.fillCircle(x, y - 2, 2.8);
      }
      this.car.setPosition(car.x * SCALE, car.y * SCALE).setRotation(car.heading);
      this.lamps.clear();
      if (car.indicator && Math.floor(world.tick / 20) % 2 === 0) {
        this.lamps.fillStyle(0xffa726);
        const y = car.indicator === 'left' ? -9 : 6;
        this.lamps.fillRect(12, y, 4, 3);
        this.lamps.fillRect(-15, y, 4, 3);
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 960,
    height: 800,
    backgroundColor: '#dce5d5',
    scene: CityScene,
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    fps: { target: 60 },
  });
  const observer = new ResizeObserver(() => {
    const { width, height } = parent.getBoundingClientRect();
    game.scale.setParentSize(width, height);
  });
  observer.observe(parent);
  return () => {
    observer.disconnect();
    game.destroy(true);
  };
}
