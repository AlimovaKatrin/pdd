import type { Point } from '../../domain/world/model';

export interface CameraTarget extends Point {
  tick: number;
  relocation?: number;
}

/** Presentation only: deterministic smoothing uses simulation time and freezes with it. */
export function nextCameraCentre(
  current: Point,
  previous: CameraTarget | null,
  target: CameraTarget,
): Point {
  if (
    !previous ||
    target.relocation !== previous.relocation ||
    target.tick < previous.tick ||
    Math.hypot(target.x - previous.x, target.y - previous.y) > 8
  ) {
    return { x: target.x, y: target.y };
  }

  if (target.tick === previous.tick) {
    return current;
  }

  const smoothing = 1 - Math.exp(-(target.tick - previous.tick) / 12);

  return {
    x: current.x + (target.x - current.x) * smoothing,
    y: current.y + (target.y - current.y) * smoothing,
  };
}
