import type { Point } from './point';

export type ApproachSide = 'north' | 'east' | 'south' | 'west';

export type Movement = 'straight' | 'left' | 'right';

export interface Lane {
  id: string;
  from: Point;
  to: Point;
  width: number;
  startJunction: string | null;
  endJunction: string | null;
  approach: ApproachSide;
  oppositeLaneId: string;
  boundaryId: string;
  speedZoneIds: string[];
}

export interface LaneBoundary {
  id: string;
  from: Point;
  to: Point;
  marking: 'solid' | 'double-solid';
  reference: '9.1.1';
}

export interface JunctionApproach {
  side: ApproachSide;
  incomingLaneId: string;
  outgoingLaneId: string;
  priority: 'main' | 'secondary' | 'equal';
  sign: 'main' | 'yield' | 'stop' | null;
  signalId?: string;
  stopId?: string;
  crossingIds: string[];
}

export interface Junction extends Point {
  id: string;
  halfSize: number;
  control: 'signals' | 'priority' | 'equal';
  approaches: JunctionApproach[];
}

export interface LaneConnection {
  id: string;
  junctionId: string;
  fromLaneId: string;
  toLaneId: string;
  movement: Movement;
  path: Point[];
}

export interface SafeRoadPosition extends Point {
  id: string;
  laneId: string;
  heading: number;
}

export interface RoadNetwork {
  lanes: Lane[];
  boundaries: LaneBoundary[];
  junctions: Junction[];
  connections: LaneConnection[];
  safePositions: SafeRoadPosition[];
}

export const APPROACH_SIDES: ApproachSide[] = ['north', 'east', 'south', 'west'];

export const SIDE_VECTOR: Record<ApproachSide, Point> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export function movementBetween(entry: ApproachSide, exit: ApproachSide): Movement | null {
  const difference = (APPROACH_SIDES.indexOf(exit) - APPROACH_SIDES.indexOf(entry) + 4) % 4;

  if (difference === 2) {
    return 'straight';
  }

  if (difference === 1) {
    return 'left';
  }

  return difference === 3 ? 'right' : null;
}
