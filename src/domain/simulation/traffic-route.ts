import type { TrafficVehicle } from '../world/vehicles';
import type { RoadNetwork } from '../world/road-network';

export function routePath(car: TrafficVehicle, network: RoadNetwork) {
  if (car.segment === 'junction') {
    return network.connections.find((item) => item.id === car.connectionId)!.path;
  }

  const lane = network.lanes.find((item) => item.id === car.laneId)!;

  return [lane.from, lane.to];
}
