import { expandedCity } from '../../src/content/maps/expanded-city';
import type { World } from '../../src/domain/world/model';
import { APPROACH_SIDES } from '../../src/domain/world/road-network';

/** Rotate a central encounter, keeping its phase and elapsed times relative to the green. */
export function rotateCentralScene(world: World, turns: number): World {
  const next = structuredClone(world);

  const network = expandedCity.network!;

  const angle = (turns * Math.PI) / 2;

  const offset = turns % 2 === 0 ? 0 : 900;

  function rotatedRoute(id: string) {
    const route = network.connections.find((item) => item.id === id)!;

    const junction = network.junctions.find((item) => item.id === route.junctionId)!;

    const side = junction.approaches.find((item) => item.incomingLaneId === route.fromLaneId)!.side;

    const rotatedSide = APPROACH_SIDES[(APPROACH_SIDES.indexOf(side) + turns) % 4];

    const fromLaneId = junction.approaches.find(
      (item) => item.side === rotatedSide,
    )!.incomingLaneId;

    return network.connections.find(
      (item) => item.fromLaneId === fromLaneId && item.movement === route.movement,
    )!;
  }

  for (const vehicle of [next.vehicle, ...next.traffic.vehicles.map((car) => car.vehicle)]) {
    const x = vehicle.x - 160;

    const y = vehicle.y - 160;

    vehicle.x = 160 + Math.cos(angle) * x - Math.sin(angle) * y;
    vehicle.y = 160 + Math.sin(angle) * x + Math.cos(angle) * y;
    vehicle.heading += angle;
  }

  next.tick += offset;

  const passage = next.junctionPassage!;

  const playerRoute = rotatedRoute(passage.connectionId);

  passage.connectionId = playerRoute.id;
  passage.incomingLaneId = playerRoute.fromLaneId;
  passage.entryHeading += angle;
  passage.enteredTick = passage.enteredTick === null ? null : passage.enteredTick + offset;

  for (const car of next.traffic.vehicles) {
    const route = rotatedRoute(car.connectionId);

    car.connectionId = route.id;
    car.laneId = route.fromLaneId;
    car.enteredTick = car.enteredTick === null ? null : car.enteredTick + offset;
  }

  return next;
}
