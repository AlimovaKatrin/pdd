import type { ReadonlyData } from './read-only';
import { VEHICLE_LENGTH, type RoadMap, type TrafficSignal, type Vehicle } from './model';

export function signalColor(signal: ReadonlyData<TrafficSignal>, tick: number) {
  const total = signal.phases.reduce((sum, phase) => sum + phase.ticks, 0);

  let phaseTick = (((tick + signal.offset) % total) + total) % total;

  for (const phase of signal.phases) {
    if (phaseTick < phase.ticks) {
      return phase.color;
    }

    phaseTick -= phase.ticks;
  }

  return signal.phases[0].color;
}

export function activeSpeedZone(map: ReadonlyData<RoadMap>, vehicle: Vehicle) {
  const x = vehicle.x + (Math.cos(vehicle.heading) * VEHICLE_LENGTH) / 2;

  const y = vehicle.y + (Math.sin(vehicle.heading) * VEHICLE_LENGTH) / 2;

  return (map.speedZones ?? [])
    .filter(
      (z) =>
        x >= z.x &&
        x < z.x + z.width &&
        y >= z.y &&
        y < z.y + z.height &&
        Math.cos(vehicle.heading) * z.direction.x + Math.sin(vehicle.heading) * z.direction.y > 0.5,
    )
    .sort((a, b) => a.limit - b.limit)[0];
}

export function angleDifference(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
