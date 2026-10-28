import { angleDifference } from '../world/traffic';
import type { DetectedViolation, Indicator, Maneuver, RoadMap, World } from '../world/model';
import type { CauseCode } from '../learning/question';
import { cause } from '../violations/causes';

// Пороги игровой геометрии в радианах, а не дополнительные требования ПДД.
const TURN_START_ANGLE_RADIANS = 0.04;

const TURN_CONFIRMATION_ANGLE_RADIANS = 0.35;

export const TURN_COMPLETION_ANGLE_RADIANS = 0.7;

/** Обновляет манёвр в next, сохраняя previous для остальных проверок шага. */
export function checkTurn(previous: World, next: World, map: RoadMap): DetectedViolation[] {
  const vehicle = next.vehicle;

  if (vehicle.speed < 0) {
    next.maneuver = null;

    return [];
  }

  const maneuver = getOrStartManeuver(previous, next, map);

  if (!maneuver) {
    return [];
  }

  const headingChange = angleDifference(vehicle.heading, maneuver.entryHeading);

  const turnAngle = Math.abs(headingChange);

  // Запоминаем начало заранее, но отличаем поворот от коррекции руля только при подтверждении.
  if (!maneuver.turning && turnAngle > TURN_START_ANGLE_RADIANS) {
    maneuver.turning = true;
    maneuver.startTick = next.tick;
    // Сигнал, включённый в том же шаге, что и поворот, уже считается поздним.
    maneuver.initialIndicator = previous.vehicle.indicator;
  }

  const detectedCauseCodes = confirmTurn(maneuver, headingChange);

  const intersection = map.intersections?.find(
    (intersection) => intersection.id === maneuver.intersectionId,
  );

  const hasLeftIntersection =
    !intersection ||
    Math.hypot(vehicle.x - intersection.x, vehicle.y - intersection.y) > intersection.radius;

  const isTurnComplete =
    hasLeftIntersection && maneuver.confirmed && turnAngle >= TURN_COMPLETION_ANGLE_RADIANS;

  // В шаге завершения уже не проверяем преждевременное выключение указателя.
  if (maneuver.confirmed && !isTurnComplete) {
    detectedCauseCodes.push(...checkIndicatorDuringTurn(maneuver, vehicle.indicator));
  }

  const newCauseCodes = detectedCauseCodes.filter((code) => !maneuver.reported.includes(code));

  maneuver.reported.push(...newCauseCodes);
  next.maneuver = hasLeftIntersection ? null : maneuver;

  if (isTurnComplete) {
    vehicle.indicator = null;
    vehicle.indicatorTurn = 0;
  }

  if (!newCauseCodes.length) {
    return [];
  }

  return [
    {
      type: 'indicator',
      roadObjectId: maneuver.intersectionId,
      episode: maneuver.episode,
      speed: vehicle.speed,
      tick: next.tick,
      causes: newCauseCodes.map((code) =>
        cause(code, {
          direction: maneuver.direction ?? '',
          initialIndicator: maneuver.initialIndicator ?? 'off',
          indicator: vehicle.indicator ?? 'off',
          startTick: maneuver.startTick,
          detectedTick: next.tick,
          angleRadians: headingChange,
        }),
      ),
    },
  ];
}

function getOrStartManeuver(previous: World, next: World, map: RoadMap): Maneuver | null {
  if (previous.maneuver) {
    return { ...previous.maneuver, reported: [...previous.maneuver.reported] };
  }

  const vehicle = next.vehicle;

  const intersection = map.intersections?.find(
    (intersection) =>
      Math.hypot(vehicle.x - intersection.x, vehicle.y - intersection.y) <= intersection.radius,
  );

  if (!intersection || vehicle.speed <= 0) {
    return null;
  }

  next.maneuverNumber++;

  return {
    valid: true,
    intersectionId: intersection.id,
    episode: next.maneuverNumber,
    entryHeading: previous.vehicle.heading,
    startTick: next.tick,
    initialIndicator: vehicle.indicator,
    turning: false,
    direction: null,
    confirmed: false,
    signalled: false,
    reported: [],
  };
}

function confirmTurn(maneuver: Maneuver, headingChange: number): CauseCode[] {
  if (!maneuver.confirmed && Math.abs(headingChange) >= TURN_CONFIRMATION_ANGLE_RADIANS) {
    maneuver.confirmed = true;
    maneuver.direction = headingChange > 0 ? 'right' : 'left';
    maneuver.signalled = maneuver.initialIndicator === maneuver.direction;

    if (!maneuver.initialIndicator) {
      return ['missing-indicator'];
    }

    if (maneuver.initialIndicator !== maneuver.direction) {
      return ['wrong-indicator'];
    }
  }

  return [];
}

function checkIndicatorDuringTurn(maneuver: Maneuver, indicator: Indicator): CauseCode[] {
  const codes: CauseCode[] = [];

  if (indicator === maneuver.direction && !maneuver.signalled) {
    codes.push('late-indicator');
    maneuver.signalled = true;
  }

  if (maneuver.signalled && indicator !== maneuver.direction) {
    codes.push('early-indicator-off');
  }

  if (indicator && indicator !== maneuver.direction) {
    codes.push('wrong-indicator');
  }

  return codes;
}
