import type { Point } from '../../domain/world/point';
import {
  APPROACH_SIDES,
  SIDE_VECTOR,
  movementBetween,
  type ApproachSide,
  type Junction,
  type Lane,
  type LaneConnection,
  type RoadNetwork,
} from '../../domain/world/road-network';

export const CITY_STREETS = [40, 160, 280];

export const JUNCTION_HALF_SIZE = 14;

const LANE_WIDTH = 7;

function junctionId(x: number, y: number) {
  return `city-${x}-${y}`;
}

function buildJunctions(): Junction[] {
  return CITY_STREETS.flatMap((x) =>
    CITY_STREETS.map((y): Junction => ({
      id: junctionId(x, y),
      x,
      y,
      halfSize: JUNCTION_HALF_SIZE,
      control: x === 160 && y === 160 ? 'signals' : x === 280 ? 'equal' : 'priority',
      approaches: [],
    })),
  );
}

function buildLanes(junctions: Junction[]) {
  const lanes: Lane[] = [];

  const boundaries: RoadNetwork['boundaries'] = [];

  function segment(from: Point, to: Point) {
    const start = junctions.find((j) => j.x === from.x && j.y === from.y);

    const end = junctions.find((j) => j.x === to.x && j.y === to.y);

    const length = Math.hypot(to.x - from.x, to.y - from.y);

    const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };

    const id = `road-${from.x}-${from.y}-${to.x}-${to.y}`;

    const a = {
      x: from.x + direction.x * (start ? JUNCTION_HALF_SIZE : 0),
      y: from.y + direction.y * (start ? JUNCTION_HALF_SIZE : 0),
    };

    const b = {
      x: to.x - direction.x * (end ? JUNCTION_HALF_SIZE : 0),
      y: to.y - direction.y * (end ? JUNCTION_HALF_SIZE : 0),
    };

    boundaries.push({ id, from: a, to: b, marking: 'double-solid', reference: '9.1.1' });

    for (const forward of [true, false]) {
      const sign = forward ? 1 : -1;

      const offset = { x: -direction.y * 3.5 * sign, y: direction.x * 3.5 * sign };

      const laneFrom = forward ? a : b;

      const laneTo = forward ? b : a;

      const approach: ApproachSide = direction.x
        ? forward
          ? 'west'
          : 'east'
        : forward
          ? 'north'
          : 'south';

      lanes.push({
        id: `${id}-${forward ? 'forward' : 'back'}`,
        from: { x: laneFrom.x + offset.x, y: laneFrom.y + offset.y },
        to: { x: laneTo.x + offset.x, y: laneTo.y + offset.y },
        width: LANE_WIDTH,
        startJunction: (forward ? start : end)?.id ?? null,
        endJunction: (forward ? end : start)?.id ?? null,
        approach,
        oppositeLaneId: `${id}-${forward ? 'back' : 'forward'}`,
        boundaryId: id,
        speedZoneIds: [],
      });
    }
  }

  const positions = [12, ...CITY_STREETS, 308];

  for (const fixed of CITY_STREETS) {
    for (let index = 1; index < positions.length; index++) {
      segment({ x: positions[index - 1], y: fixed }, { x: positions[index], y: fixed });
      segment({ x: fixed, y: positions[index - 1] }, { x: fixed, y: positions[index] });
    }
  }

  return { lanes, boundaries };
}

function connectionPath(from: Point, to: Point, entry: ApproachSide, exit: ApproachSide): Point[] {
  const movement = movementBetween(entry, exit);

  if (movement === 'straight') {
    return [{ ...from }, { ...to }];
  }

  // Circular quarter-turns retain lane tangents. Opposing left turns pass right sides.
  const centre = SIDE_VECTOR[entry].x ? { x: from.x, y: to.y } : { x: to.x, y: from.y };

  const angle = Math.atan2(from.y - centre.y, from.x - centre.x);

  const radius = Math.hypot(from.x - centre.x, from.y - centre.y);

  const rotation = movement === 'left' ? -Math.PI / 2 : Math.PI / 2;

  return Array.from({ length: 25 }, (_, index) => {
    if (index === 0) {
      return { ...from };
    }

    if (index === 24) {
      return { ...to };
    }

    return {
      x: centre.x + Math.cos(angle + (rotation * index) / 24) * radius,
      y: centre.y + Math.sin(angle + (rotation * index) / 24) * radius,
    };
  });
}

export function createCityNetwork(): RoadNetwork {
  const junctions = buildJunctions();

  const { lanes, boundaries } = buildLanes(junctions);

  const connections: LaneConnection[] = [];

  for (const junction of junctions) {
    junction.approaches = APPROACH_SIDES.map((side) => {
      const incoming = lanes.find(
        (lane) => lane.endJunction === junction.id && lane.approach === side,
      )!;

      const isMain = side === 'east' || side === 'west';

      const priority = junction.control === 'priority' ? (isMain ? 'main' : 'secondary') : 'equal';

      const sign =
        priority === 'main'
          ? 'main'
          : priority === 'secondary'
            ? side === 'south'
              ? 'stop'
              : 'yield'
            : null;

      return {
        side,
        incomingLaneId: incoming.id,
        outgoingLaneId: incoming.oppositeLaneId,
        priority,
        sign,
        ...(junction.control === 'signals' && { signalId: `${junction.id}-${side}-signal` }),
        ...(sign === 'stop' && { stopId: `${junction.id}-${side}-stop` }),
        crossingIds: [],
      };
    });

    for (const entry of junction.approaches) {
      for (const exit of junction.approaches) {
        const movement = movementBetween(entry.side, exit.side);

        if (!movement) {
          continue;
        }

        const incoming = lanes.find((lane) => lane.id === entry.incomingLaneId)!;

        const outgoing = lanes.find((lane) => lane.id === exit.outgoingLaneId)!;

        connections.push({
          id: `${junction.id}-${entry.side}-${movement}`,
          junctionId: junction.id,
          fromLaneId: incoming.id,
          toLaneId: outgoing.id,
          movement,
          path: connectionPath(incoming.to, outgoing.from, entry.side, exit.side),
        });
      }
    }
  }

  const safePositions = lanes
    .filter((lane) => lane.startJunction && lane.endJunction)
    .map((lane) => ({
      id: `safe-${lane.id}`,
      laneId: lane.id,
      x: (lane.from.x + lane.to.x) / 2,
      y: (lane.from.y + lane.to.y) / 2,
      heading: Math.atan2(lane.to.y - lane.from.y, lane.to.x - lane.from.x),
    }));

  return { lanes, boundaries, junctions, connections, safePositions };
}
