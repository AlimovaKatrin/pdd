import type { World } from '../world/model';
import type { Vehicle } from '../world/vehicles';
import { vehicleContactFraction } from '../world/swept-vehicles';

export interface Collision {
  tick: number;
  fraction: number;
  participantId: string;
  participantLabel: string;
  player: Vehicle;
  other: Vehicle;
}

/** Contact is a physical event; it never establishes a road violation or legal fault. */
export function detectCollision(previous: World, next: World): Collision | null {
  let collision: Collision | null = null;

  for (const car of next.traffic.vehicles) {
    const before =
      previous.traffic.vehicles.find((item) => item.id === car.id)?.vehicle ?? car.vehicle;

    const fraction = vehicleContactFraction(previous.vehicle, next.vehicle, before, car.vehicle);

    if (fraction === null || (collision && fraction >= collision.fraction)) {
      continue;
    }

    collision = {
      tick: next.tick,
      fraction,
      participantId: car.id,
      participantLabel: car.label,
      player: { ...next.vehicle },
      other: { ...car.vehicle },
    };
  }

  return collision;
}
