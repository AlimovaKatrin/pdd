import { activeSpeedZone } from '../world/traffic';
import type { DetectedViolation, RoadMap, World } from '../world/model';
import { cause } from '../violations/causes';
export function checkSpeed(world: World, map: RoadMap): DetectedViolation[] {
  const zone = activeSpeedZone(map, world.vehicle),
    events: DetectedViolation[] = [];
  for (const z of map.speedZones ?? []) {
    const state = world.speedEpisodes[z.id] ?? { active: false, number: 1 };
    const exceeding = z.id === zone?.id && Math.abs(world.vehicle.speed) > z.limit / 3.6;
    if (exceeding && !state.active) {
      events.push({
        type: 'speed',
        roadObjectId: z.id,
        episode: state.number,
        speed: world.vehicle.speed,
        tick: world.tick,
        causes: [
          cause('speed-limit', {
            speedKmh: Math.abs(world.vehicle.speed) * 3.6,
            limitKmh: z.limit,
          }),
        ],
      });
    }
    world.speedEpisodes[z.id] = {
      active: exceeding,
      number: state.number + (state.active && !exceeding ? 1 : 0),
    };
  }
  return events;
}
