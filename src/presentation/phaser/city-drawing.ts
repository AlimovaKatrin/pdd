import type Phaser from 'phaser';

// The domain uses meters; only rendering converts them to canvas pixels.
export const PIXELS_PER_METER = 8;

export const CANVAS_WIDTH = 960;

export const CANVAS_HEIGHT = 800;

// Label positions and font sizes are in canvas pixels.
export function addMapLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = '#6d8172',
  fontSize = 10,
) {
  return scene.add
    .text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize,
      color,
      letterSpacing: 2,
    })
    .setOrigin(0.5);
}
