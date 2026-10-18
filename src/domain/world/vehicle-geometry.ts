import { VEHICLE_LENGTH, VEHICLE_WIDTH, type Vehicle } from './vehicles';

/** Separating axes for two oriented rectangles; padding is a technical safety margin. */
export function vehiclesOverlap(first: Vehicle, second: Vehicle, padding = 0): boolean {
  const axes = [
    first.heading,
    first.heading + Math.PI / 2,
    second.heading,
    second.heading + Math.PI / 2,
  ];

  for (const angle of axes) {
    const distance = Math.abs(
      (second.x - first.x) * Math.cos(angle) + (second.y - first.y) * Math.sin(angle),
    );

    const radius = (vehicle: Vehicle) =>
      (Math.abs(Math.cos(vehicle.heading - angle)) * VEHICLE_LENGTH) / 2 +
      (Math.abs(Math.sin(vehicle.heading - angle)) * VEHICLE_WIDTH) / 2;

    if (distance >= radius(first) + radius(second) + padding) {
      return false;
    }
  }

  return true;
}
