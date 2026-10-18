import type { RoadMap, World } from '../world/model';
import type { TrafficVehicle, TrafficReaction } from '../world/vehicles';
import type { LaneConnection, RoadNetwork } from '../world/road-network';
import { laneAt, connectionForVehicle } from '../world/road-context';
import { pointDistance } from '../world/path-geometry';
import { signalColor } from '../world/traffic';
import { compareJunctionPaths } from '../world/junction-priority';

function playerConnection(
  world: World,
  network: RoadNetwork,
  junctionId: string,
): LaneConnection | null {
  const lane = laneAt(network, world.vehicle);

  if (lane?.endJunction === junctionId) {
    const heading = Math.atan2(lane.to.y - lane.from.y, lane.to.x - lane.from.x);

    if (Math.cos(world.vehicle.heading - heading) < 0.5) {
      return null;
    }

    return (
      network.connections.find(
        (item) => item.fromLaneId === lane.id && item.movement === 'straight',
      ) ?? null
    );
  }

  for (const approach of network.junctions.find((item) => item.id === junctionId)!.approaches) {
    const connection = connectionForVehicle(network, approach.incomingLaneId, world.vehicle);

    if (connection) {
      return connection as LaneConnection;
    }
  }

  return null;
}

export function priorityObstacle(
  car: TrafficVehicle,
  world: World,
  map: RoadMap,
): TrafficReaction | null {
  const network = map.network!;

  const connection = network.connections.find((item) => item.id === car.connectionId);

  if (!connection || car.segment === 'junction') {
    return null;
  }

  const junction = network.junctions.find((item) => item.id === connection.junctionId)!;

  const participants = world.traffic.vehicles
    .filter((item) => item.id !== car.id)
    .map((item) => ({
      id: item.id,
      vehicle: item.vehicle,
      connection: network.connections.find((route) => route.id === item.connectionId),
      inside: item.segment === 'junction',
    }));

  const playerPath = playerConnection(world, network, junction.id);

  participants.push({
    id: 'player',
    vehicle: world.vehicle,
    connection: playerPath ?? undefined,
    inside: !laneAt(network, world.vehicle),
  });

  for (const participant of participants) {
    const otherPath = participant.connection;

    if (
      !otherPath ||
      otherPath.junctionId !== junction.id ||
      pointDistance(participant.vehicle, junction) > junction.halfSize + 30
    ) {
      continue;
    }

    const otherApproach = junction.approaches.find(
      (item) => item.incomingLaneId === otherPath.fromLaneId,
    );

    const signal = map.signals?.find((item) => item.id === otherApproach?.signalId);

    if (!participant.inside && signal && signalColor(signal, world.tick) !== 'green') {
      continue;
    }

    const relation = compareJunctionPaths(junction, connection, otherPath);

    if (!relation.conflict || relation.yields === 'queue') {
      continue;
    }

    if (junction.control === 'signals' && participant.inside) {
      return {
        reason: 'priority',
        participantId: participant.id,
        junctionId: junction.id,
        reference: '13.8',
      };
    }

    if (relation.yields === 'first') {
      return {
        reason: 'priority',
        participantId: participant.id,
        junctionId: junction.id,
        reference: relation.reference ?? undefined,
      };
    }
  }

  return null;
}
