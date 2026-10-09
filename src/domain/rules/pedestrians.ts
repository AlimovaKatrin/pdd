import { cause } from '../violations/causes';
import {
  VEHICLE_LENGTH,
  VEHICLE_WIDTH,
  type Crossing,
  type DetectedViolation,
  type PedestrianState,
  type RoadMap,
  type World,
} from '../world/model';
export function pedestrianPosition(c: Crossing, p: PedestrianState) {
  return {
    x: c.from.x + (c.to.x - c.from.x) * p.progress,
    y: c.from.y + (c.to.y - c.from.y) * p.progress,
  };
}
export function checkPedestrians(
  previous: World,
  next: World,
  map: RoadMap,
  dt: number,
): DetectedViolation[] {
  const violations: DetectedViolation[] = [];
  for (const c of map.crossings ?? []) {
    const old = previous.pedestrians[c.id];
    const p = { ...old, reaction: null } as PedestrianState;
    next.pedestrians[c.id] = p;
    if (p.waiting > 0) {
      p.waiting--;
      if (!p.waiting) {
        p.progress = 0;
        p.episode++;
        p.obstructed = false;
      }
      continue;
    }
    const length = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
    const position = pedestrianPosition(c, p);
    const vx = Math.cos(next.vehicle.heading),
      vy = Math.sin(next.vehicle.heading);
    // The pedestrian intends to walk. Brakes only for a predicted shared footprint,
    // sampled at 0.1 s over a 1.2 s reaction horizon, never just for proximity.
    let conflict = false;
    if (Math.hypot(position.x - next.vehicle.x, position.y - next.vehicle.y) < 20) {
      for (let t = 0; t <= 1.2; t += 0.1) {
        const progress = p.progress + (c.speed * t) / length;
        if (progress > 1) {
          break;
        }
        const px = c.from.x + (c.to.x - c.from.x) * progress;
        const py = c.from.y + (c.to.y - c.from.y) * progress;
        const dx = px - next.vehicle.x - vx * next.vehicle.speed * t;
        const dy = py - next.vehicle.y - vy * next.vehicle.speed * t;
        if (
          Math.abs(dx * vx + dy * vy) < VEHICLE_LENGTH / 2 + 0.35 &&
          Math.abs(-dx * vy + dy * vx) < VEHICLE_WIDTH / 2 + 0.35
        ) {
          conflict = true;
          break;
        }
      }
    }
    if (conflict) {
      p.reaction = 'vehicle';
      if (!p.obstructed) {
        p.obstructed = true;
        violations.push({
          type: 'pedestrian',
          roadObjectId: c.id,
          episode: p.episode,
          speed: next.vehicle.speed,
          tick: next.tick,
          causes: [
            cause('pedestrian-obstruction', {
              priority: true,
              intendedSpeed: c.speed,
              actualSpeed: 0,
              reaction: 'braking-for-vehicle',
              progress: p.progress,
            }),
          ],
        });
      }
    } else {
      p.progress = Math.min(1, p.progress + (c.speed * dt) / length);
      if (p.progress === 1) {
        p.waiting = c.restartTicks;
      }
    }
  }
  return violations;
}
