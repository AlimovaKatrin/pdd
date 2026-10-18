import type { RoadMap, World } from '../world/model';
import type { TrafficVehicle, TrafficReaction } from '../world/vehicles';
import { remainingJunctionPath } from '../world/remaining-junction-path';
import { VEHICLE_WIDTH } from '../world/vehicles';
import { pathsConflict, pointDistance } from '../world/path-geometry';
import { junctionDuty, type JunctionParticipant } from '../world/junction-duty';

export function priorityObstacle(
  car: TrafficVehicle,
  world: World,
  map: RoadMap,
): TrafficReaction | null {
  const network = map.network!;

  const connection = network.connections.find((item) => item.id === car.connectionId);

  if (!connection) {
    return null;
  }

  const junction = network.junctions.find((item) => item.id === connection.junctionId)!;

  const participants: { id: string; vehicle: World['vehicle']; passage: JunctionParticipant }[] =
    world.traffic.vehicles
      .filter((item) => item.id !== car.id)
      .map((item) => ({
        id: item.id,
        vehicle: item.vehicle,
        passage: item,
      }));

  if (world.junctionPassage) {
    participants.push({ id: 'player', vehicle: world.vehicle, passage: world.junctionPassage });
  }

  for (const participant of participants) {
    if (pointDistance(participant.vehicle, junction) > junction.halfSize + 30) {
      continue;
    }

    const otherConnection = network.connections.find(
      (item) => item.id === participant.passage.connectionId,
    );

    if (!otherConnection || otherConnection.junctionId !== junction.id) {
      continue;
    }

    const firstPath = remainingJunctionPath(connection.path, car.vehicle);

    const secondPath = remainingJunctionPath(otherConnection.path, participant.vehicle);

    if (!pathsConflict(firstPath, secondPath, VEHICLE_WIDTH + 0.4)) {
      continue;
    }

    if (junction.control === 'priority') {
      // A cautious driver leaves the occupied path clear. This is not a legal priority rule.
      if (car.enteredTick === null && participant.passage.enteredTick !== null) {
        return { reason: 'vehicle', participantId: participant.id, junctionId: junction.id };
      }

      if (car.enteredTick !== null && participant.passage.enteredTick === null) {
        continue;
      }
    }

    if (junctionDuty(map, car, participant.passage, world.tick)) {
      return { reason: 'priority', participantId: participant.id, junctionId: junction.id };
    }
  }

  return null;
}
