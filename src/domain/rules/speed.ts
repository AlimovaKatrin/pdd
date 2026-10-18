import { activeSpeedLimit } from '../world/traffic';
import type { DetectedViolation, RoadMap, World } from '../world/model';
import { cause } from '../violations/causes';

export function checkSpeed(world: World, map: RoadMap): DetectedViolation[] {
  const limit = activeSpeedLimit(map, world.vehicle);

  const events: DetectedViolation[] = [];

  for (const zone of [map.citySpeedLimit, ...(map.speedZones ?? [])]) {
    const state = world.speedEpisodes[zone.id] ?? { active: false, number: 1 };

    const exceeding = zone.id === limit.id && Math.abs(world.vehicle.speed) > zone.limit / 3.6;

    if (exceeding && !state.active) {
      events.push({
        type: 'speed',
        roadObjectId: zone.id,
        episode: state.number,
        speed: world.vehicle.speed,
        tick: world.tick,
        causes: [
          cause(zone.id === map.citySpeedLimit.id ? 'city-speed-limit' : 'speed-limit', {
            speedKmh: Math.abs(world.vehicle.speed) * 3.6,
            limitKmh: zone.limit,
          }),
        ],
      });
    }

    world.speedEpisodes[zone.id] = {
      active: exceeding,
      number: state.number + (state.active && !exceeding ? 1 : 0),
    };
  }

  return events;
}
