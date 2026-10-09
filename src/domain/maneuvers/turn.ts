import { angleDifference } from '../world/traffic';
import type { DetectedViolation, RoadMap, World } from '../world/model';
import type { CauseCode } from '../learning/question';
import { cause } from '../violations/causes';
// Geometry thresholds classify game movement; they are not legal timing requirements.
export function checkTurn(previous: World, next: World, map: RoadMap): DetectedViolation[] {
  const v = next.vehicle;
  if (v.speed < 0) {
    next.maneuver = null;
    return [];
  }
  let m = previous.maneuver
    ? { ...previous.maneuver, reported: [...previous.maneuver.reported] }
    : null;
  if (!m) {
    const junction = map.intersections?.find((j) => Math.hypot(v.x - j.x, v.y - j.y) <= j.radius);
    if (!junction || v.speed <= 0) {
      return [];
    }
    next.maneuverNumber++;
    m = {
      intersectionId: junction.id,
      episode: next.maneuverNumber,
      entryHeading: previous.vehicle.heading,
      startTick: next.tick,
      initialIndicator: v.indicator,
      turning: false,
      direction: null,
      confirmed: false,
      signalled: false,
      reported: [],
    };
  }
  const angle = angleDifference(v.heading, m.entryHeading);
  if (!m.turning && Math.abs(angle) > 0.04) {
    m.turning = true;
    m.startTick = next.tick;
    m.initialIndicator = previous.vehicle.indicator;
  }
  const codes: CauseCode[] = [];
  if (!m.confirmed && Math.abs(angle) >= 0.35) {
    m.confirmed = true;
    m.direction = angle > 0 ? 'right' : 'left';
    if (!m.initialIndicator) {
      codes.push('missing-indicator');
    } else if (m.initialIndicator !== m.direction) {
      codes.push('wrong-indicator');
    }
    m.signalled = m.initialIndicator === m.direction;
  }
  const junction = map.intersections?.find((j) => j.id === m.intersectionId);
  const outside = !junction || Math.hypot(v.x - junction.x, v.y - junction.y) > junction.radius;
  const finished = outside && m.confirmed && Math.abs(angle) >= 0.7;
  if (m.confirmed && !finished) {
    if (v.indicator === m.direction && !m.signalled) {
      codes.push('late-indicator');
      m.signalled = true;
    }
    if (m.signalled && v.indicator !== m.direction) {
      codes.push('early-indicator-off');
    }
    if (v.indicator && v.indicator !== m.direction) {
      codes.push('wrong-indicator');
    }
  }
  const fresh = codes.filter((c) => !m.reported.includes(c));
  m.reported.push(...fresh);
  next.maneuver = outside ? null : m;
  if (finished) {
    v.indicator = null;
    v.indicatorTurn = 0;
  }
  return fresh.length
    ? [
        {
          type: 'indicator',
          roadObjectId: m.intersectionId,
          episode: m.episode,
          speed: v.speed,
          tick: next.tick,
          causes: fresh.map((c) =>
            cause(c, {
              direction: m.direction ?? '',
              initialIndicator: m.initialIndicator ?? 'off',
              indicator: v.indicator ?? 'off',
              startTick: m.startTick,
              detectedTick: next.tick,
              angleRadians: angle,
            }),
          ),
        },
      ]
    : [];
}
