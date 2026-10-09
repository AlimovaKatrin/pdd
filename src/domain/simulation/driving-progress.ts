import { PEDESTRIAN_CLEARANCE_METERS } from '../world/pedestrian';
import { TURN_COMPLETION_ANGLE_RADIANS } from '../maneuvers/turn';
import { crossingFraction, distance, front, within } from '../rules/geometry';
import { activeSpeedZone, angleDifference, signalColor } from '../world/traffic';
import { VEHICLE_WIDTH, type DetectedViolation, type RoadMap, type World } from '../world/model';

/** Counts completed rule situations, never frames or the mere absence of a violation. */
export function updateDrivingProgress(
  previous: World,
  next: World,
  map: RoadMap,
  violations: DetectedViolation[],
) {
  const progress = structuredClone(previous.drivingProgress);

  next.drivingProgress = progress;

  for (const signal of map.signals ?? []) {
    if (
      previous.signalEpisodes[signal.id].phase !== 'ready' ||
      next.signalEpisodes[signal.id].phase !== 'crossed'
    ) {
      continue;
    }

    const fraction = crossingFraction(previous.vehicle, next.vehicle, signal.line);

    if (fraction !== null && signalColor(signal, previous.tick + fraction) === 'green') {
      next.successfulManeuvers++;
    }
  }

  const maneuver = previous.maneuver;

  if (
    maneuver?.confirmed &&
    !next.maneuver &&
    next.vehicle.speed > 0 &&
    Math.abs(angleDifference(next.vehicle.heading, maneuver.entryHeading)) >=
      TURN_COMPLETION_ANGLE_RADIANS &&
    maneuver.initialIndicator === maneuver.direction &&
    previous.vehicle.indicator === maneuver.direction &&
    !maneuver.reported.length &&
    !violations.some((v) => v.type === 'indicator' && v.episode === maneuver.episode)
  ) {
    next.successfulManeuvers++;
  }

  const beforeZone = activeSpeedZone(map, previous.vehicle);

  const afterZone = activeSpeedZone(map, next.vehicle);

  const before = front(previous.vehicle);

  const after = front(next.vehicle);

  for (const zone of map.speedZones ?? []) {
    const along = (p: typeof before) =>
      (p.x - zone.sign.x) * zone.direction.x + (p.y - zone.sign.y) * zone.direction.y;

    const end = along(zone.end);

    if (along(before) < 0 && along(after) >= 0 && afterZone?.id === zone.id) {
      progress.speed[zone.id] = { valid: true };
    }

    const passage = progress.speed[zone.id];

    if (!passage) {
      continue;
    }

    if (
      next.vehicle.speed < 0 ||
      Math.abs(next.vehicle.speed) > zone.limit / 3.6 ||
      (beforeZone?.id === zone.id && Math.abs(previous.vehicle.speed) > zone.limit / 3.6)
    ) {
      passage.valid = false;
    }

    if (afterZone?.id !== zone.id) {
      const forward =
        Math.cos(next.vehicle.heading) * zone.direction.x +
        Math.sin(next.vehicle.heading) * zone.direction.y;

      if (
        passage.valid &&
        beforeZone?.id === zone.id &&
        along(before) < end &&
        along(after) >= end &&
        forward > 0.5 &&
        next.vehicle.speed > 0
      ) {
        next.successfulManeuvers++;
      }

      delete progress.speed[zone.id];
    }
  }

  for (const crossing of map.crossings ?? []) {
    const pedestrian = next.pedestrians[crossing.id];

    const oldPedestrian = previous.pedestrians[crossing.id];

    // Use the physical crossing, in either driving direction, rather than the approach marker.
    const heading =
      Math.cos(next.vehicle.heading) * crossing.line.direction.x +
      Math.sin(next.vehicle.heading) * crossing.line.direction.y;

    const sign = heading >= 0 ? 1 : -1;

    const line = {
      ...crossing.line,
      a: crossing.from,
      b: crossing.to,
      direction: { x: crossing.line.direction.x * sign, y: crossing.line.direction.y * sign },
    };

    const gap = distance(next.vehicle, line);

    const approaching = Math.abs(heading) > 0.5 && within(next.vehicle, line) && gap >= 0;

    if (!approaching || gap > 18) {
      delete progress.pedestrians[crossing.id];
      continue;
    }

    let encounter: (typeof progress.pedestrians)[string] | undefined =
      progress.pedestrians[crossing.id];

    if (encounter?.credited) {
      continue;
    }

    if (encounter?.episode !== pedestrian.episode) {
      delete progress.pedestrians[crossing.id];
      encounter = undefined;
    }

    const dx = crossing.to.x - crossing.from.x;

    const dy = crossing.to.y - crossing.from.y;

    const pathLength = Math.hypot(dx, dy);

    const vehicleOnPath =
      ((next.vehicle.x - crossing.from.x) * dx + (next.vehicle.y - crossing.from.y) * dy) /
      (pathLength * pathLength);

    const laneClearedAt =
      vehicleOnPath + (VEHICLE_WIDTH / 2 + PEDESTRIAN_CLEARANCE_METERS) / pathLength;

    if (
      !encounter &&
      gap <= 8 &&
      oldPedestrian.progress > 0 &&
      oldPedestrian.progress < Math.min(1, laneClearedAt)
    ) {
      encounter = { episode: pedestrian.episode, valid: true, credited: false };
      progress.pedestrians[crossing.id] = encounter;
    }

    if (encounter) {
      encounter.valid &&= !pedestrian.obstructed && next.vehicle.speed >= 0;

      if (encounter.valid && gap <= 8 && oldPedestrian.progress < 1 && pedestrian.progress === 1) {
        next.successfulManeuvers++;
        encounter.credited = true;
      }
    }
  }
}
