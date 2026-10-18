import type { RoadMap, World } from '../world/model';
import type { TrafficVehicle, TrafficReaction } from '../world/vehicles';
import { pointDistance } from '../world/path-geometry';
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

    if (junctionDuty(map, car, participant.passage, world.tick)) {
      return { reason: 'priority', participantId: participant.id, junctionId: junction.id };
    }
  }

  return null;
}
