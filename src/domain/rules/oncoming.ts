import type { DetectedViolation, RoadMap, Vehicle, World } from '../world/model';
import type { RoadNetwork } from '../world/road-network';
import { laneOccupation } from '../world/road-context';
import { crossesRoadArea } from '../world/swept-road-area';
import { cause } from '../violations/causes';

function prohibitedArea(network: RoadNetwork, previous: Vehicle, next: Vehicle): string | null {
  for (const boundary of network.boundaries) {
    if (crossesRoadArea(previous, next, boundary.from, boundary.to, 0)) {
      return boundary.id;
    }
  }

  for (const lane of network.lanes) {
    const heading = Math.atan2(lane.to.y - lane.from.y, lane.to.x - lane.from.x);

    if (Math.cos(next.heading - heading) >= -0.1) {
      continue;
    }

    if (crossesRoadArea(previous, next, lane.from, lane.to, lane.width)) {
      return lane.boundaryId;
    }
  }

  return null;
}

export function checkOncoming(previous: World, next: World, map: RoadMap): DetectedViolation[] {
  const network = map.network;

  if (!network || previous.relocation !== next.relocation) {
    return [];
  }

  const episode = { ...previous.oncomingEpisode };

  next.oncomingEpisode = episode;

  const moved = Math.hypot(
    next.vehicle.x - previous.vehicle.x,
    next.vehicle.y - previous.vehicle.y,
  );

  const boundaryId = moved > 1e-8 ? prohibitedArea(network, previous.vehicle, next.vehicle) : null;

  const events: DetectedViolation[] = [];

  if (boundaryId && !episode.active) {
    episode.active = true;
    events.push({
      type: 'oncoming',
      roadObjectId: boundaryId,
      episode: episode.number,
      tick: next.tick,
      speed: next.vehicle.speed,
      causes: [
        cause('oncoming-lane', {
          boundaryId,
          marking: network.boundaries.find((boundary) => boundary.id === boundaryId)!.marking,
          playerHeading: next.vehicle.heading,
        }),
      ],
    });
  }

  // Passing through a junction does not create a new episode. Return fully to one's lane first.
  const returned = network.lanes.some((lane) => {
    const heading = Math.atan2(lane.to.y - lane.from.y, lane.to.x - lane.from.x);

    return (
      Math.cos(next.vehicle.heading - heading) > 0.5 && laneOccupation(lane, next.vehicle).contained
    );
  });

  if (episode.active && returned) {
    episode.active = false;
    episode.number++;
  }

  return events;
}
