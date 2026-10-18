import { VEHICLE_LENGTH, VEHICLE_WIDTH, type Vehicle } from './vehicles';
import { angleDifference } from './traffic';

export function interpolateVehicle(from: Vehicle, to: Vehicle, fraction: number): Vehicle {
  return {
    ...to,
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    heading: from.heading + angleDifference(to.heading, from.heading) * fraction,
  };
}

function projectedRadius(heading: number, axis: number) {
  return (
    (Math.abs(Math.cos(heading - axis)) * VEHICLE_LENGTH) / 2 +
    (Math.abs(Math.sin(heading - axis)) * VEHICLE_WIDTH) / 2
  );
}

/** Continuous translation of oriented boxes; rotation is enclosed conservatively in small arcs. */
export function vehicleContactFraction(
  firstFrom: Vehicle,
  firstTo: Vehicle,
  secondFrom: Vehicle,
  secondTo: Vehicle,
): number | null {
  const firstTurn = Math.abs(angleDifference(firstTo.heading, firstFrom.heading));

  const secondTurn = Math.abs(angleDifference(secondTo.heading, secondFrom.heading));

  const parts = Math.max(1, Math.ceil(Math.max(firstTurn, secondTurn) / 0.02));

  const halfDiagonal = Math.hypot(VEHICLE_LENGTH, VEHICLE_WIDTH) / 2;

  const rotationMargin = (halfDiagonal * (firstTurn + secondTurn)) / (2 * parts);

  for (let part = 0; part < parts; part++) {
    const start = part / parts;

    const end = (part + 1) / parts;

    const a = interpolateVehicle(firstFrom, firstTo, start);

    const b = interpolateVehicle(secondFrom, secondTo, start);

    const aEnd = interpolateVehicle(firstFrom, firstTo, end);

    const bEnd = interpolateVehicle(secondFrom, secondTo, end);

    const aHeading = (a.heading + aEnd.heading) / 2;

    const bHeading = (b.heading + bEnd.heading) / 2;

    let enter = 0;

    let exit = 1;

    for (const axis of [aHeading, aHeading + Math.PI / 2, bHeading, bHeading + Math.PI / 2]) {
      const distance = (b.x - a.x) * Math.cos(axis) + (b.y - a.y) * Math.sin(axis);

      const velocity =
        (bEnd.x - b.x - (aEnd.x - a.x)) * Math.cos(axis) +
        (bEnd.y - b.y - (aEnd.y - a.y)) * Math.sin(axis);

      const radius =
        projectedRadius(aHeading, axis) + projectedRadius(bHeading, axis) + rotationMargin;

      if (Math.abs(velocity) < 1e-12) {
        if (Math.abs(distance) > radius) {
          exit = -1;
          break;
        }

        continue;
      }

      const first = (-radius - distance) / velocity;

      const last = (radius - distance) / velocity;

      enter = Math.max(enter, Math.min(first, last));
      exit = Math.min(exit, Math.max(first, last));

      if (enter > exit) {
        break;
      }
    }

    if (enter <= exit) {
      return start + enter / parts;
    }
  }

  return null;
}
