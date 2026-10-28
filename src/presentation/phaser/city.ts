import Phaser from 'phaser';
import type { GameSession } from '../../use-cases/session/game-session';
import { CANVAS_HEIGHT, CANVAS_WIDTH, PIXELS_PER_METER } from './city-drawing';
import { drawCityScenery } from './city-scenery';
import { drawRoadFeatures, drawSpawnMarker, drawStopSigns } from './road-features';
import { drawTraffic } from './traffic-view';
import { createVehicleView } from './vehicle-view';

import { drawNetworkScenery } from './network-scenery';
import { nextCameraCentre, type CameraTarget } from './follow-camera';

export function mountCity(parent: HTMLElement, session: GameSession) {
  class CityScene extends Phaser.Scene {
    private vehicle?: ReturnType<typeof createVehicleView>;

    private traffic!: Phaser.GameObjects.Graphics;

    private otherVehicles = new Map<string, ReturnType<typeof createVehicleView>>();

    private previousTarget: CameraTarget | null = null;

    private cameraCentre = { ...session.map.spawn };

    create() {
      const scenery = this.add.graphics();

      if (session.map.network) {
        drawNetworkScenery(this, scenery, session.map);
        this.cameras.main.setBounds(
          0,
          0,
          session.map.width * PIXELS_PER_METER,
          session.map.height * PIXELS_PER_METER,
        );
        this.cameras.main.centerOn(
          session.map.spawn.x * PIXELS_PER_METER,
          session.map.spawn.y * PIXELS_PER_METER,
        );
      } else {
        drawCityScenery(this, scenery, session.map);
      }

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

      for (const [id, view] of this.otherVehicles) {
        if (!world.traffic.vehicles.some((car) => car.id === id)) {
          view.destroy();
          this.otherVehicles.delete(id);
        }
      }

      for (const car of world.traffic.vehicles) {
        let view = this.otherVehicles.get(car.id);

        if (!view) {
          view = createVehicleView(this, car.vehicle, { color: 0x8a967c, label: car.label });
          this.otherVehicles.set(car.id, view);
        }

        view.update(car.vehicle, world.tick);
      }

      this.vehicle.update(world.vehicle, world.tick);

      if (session.map.network) {
        const target = {
          x: world.vehicle.x,
          y: world.vehicle.y,
          tick: world.tick,
          relocation: world.relocation,
        };

        this.cameraCentre = {
          ...this.cameraCentre,
          ...nextCameraCentre(this.cameraCentre, this.previousTarget, target),
        };
        this.previousTarget = target;
        this.cameras.main.centerOn(
          this.cameraCentre.x * PIXELS_PER_METER,
          this.cameraCentre.y * PIXELS_PER_METER,
        );
      }
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
    // Input belongs to the application adapter; Phaser only renders the world.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: {
      // Resize the view, keeping road and vehicle sizes; fit the legacy map in full.
      mode: session.map.network ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
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
