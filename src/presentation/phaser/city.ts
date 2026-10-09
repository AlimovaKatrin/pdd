import Phaser from 'phaser';
import type { GameSession } from '../../use-cases/session/game-session';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './city-drawing';
import { drawCityScenery } from './city-scenery';
import { drawRoadFeatures, drawSpawnMarker, drawStopSigns } from './road-features';
import { drawTraffic } from './traffic-view';
import { createVehicleView } from './vehicle-view';

export function mountCity(parent: HTMLElement, session: GameSession) {
  class CityScene extends Phaser.Scene {
    private vehicle?: ReturnType<typeof createVehicleView>;

    private traffic!: Phaser.GameObjects.Graphics;

    create() {
      const scenery = this.add.graphics();

      drawCityScenery(this, scenery, session.map);
      drawRoadFeatures(this, scenery, session.map);
      this.traffic = this.add.graphics();
      // STOP labels stay above the traffic layer.
      drawStopSigns(this, scenery, session.map);
      drawSpawnMarker(scenery, session.map);
      this.vehicle = createVehicleView(this, session.map.spawn);
    }

    update() {
      if (!this.vehicle) {
        return;
      }

      const world = session.getWorld();

      drawTraffic(this.traffic, session.map, world);
      this.vehicle.update(world.vehicle, world.tick);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
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
