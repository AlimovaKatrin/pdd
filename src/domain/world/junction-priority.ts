import type { ReadonlyData } from './read-only';
import { APPROACH_SIDES, type Junction, type LaneConnection } from './road-network';
import { pathsConflict } from './path-geometry';
import { VEHICLE_WIDTH } from './model';

export type PriorityRelation = {
  conflict: boolean;
  yields: 'first' | 'second' | 'queue' | 'signals' | 'neither';
  reference: string | null;
};

/** Static path relation. Signals, arrival time and actual obstruction are checked separately. */
export function compareJunctionPaths(
  junction: ReadonlyData<Junction>,
  first: ReadonlyData<LaneConnection>,
  second: ReadonlyData<LaneConnection>,
): PriorityRelation {
  const entryA = junction.approaches.find((entry) => entry.incomingLaneId === first.fromLaneId);

  const entryB = junction.approaches.find((entry) => entry.incomingLaneId === second.fromLaneId);

  if (!entryA || !entryB || first.junctionId !== junction.id || second.junctionId !== junction.id) {
    throw new Error('Paths must belong to the same junction');
  }

  if (entryA.side === entryB.side) {
    return { conflict: true, yields: 'queue', reference: '9.10' };
  }

  const conflict = pathsConflict(first.path, second.path, VEHICLE_WIDTH + 0.4);

  if (!conflict) {
    return { conflict: false, yields: 'neither', reference: null };
  }

  const difference =
    (APPROACH_SIDES.indexOf(entryB.side) - APPROACH_SIDES.indexOf(entryA.side) + 4) % 4;

  if (junction.control === 'signals') {
    if (difference !== 2) {
      return { conflict: true, yields: 'signals', reference: '6.2, 13.8' };
    }

    if (first.movement === 'left' && second.movement !== 'left') {
      return { conflict: true, yields: 'first', reference: '13.4' };
    }

    if (second.movement === 'left' && first.movement !== 'left') {
      return { conflict: true, yields: 'second', reference: '13.4' };
    }
  }

  if (junction.control === 'priority' && entryA.priority !== entryB.priority) {
    return {
      conflict: true,
      yields: entryA.priority === 'secondary' ? 'first' : 'second',
      reference: '13.9',
    };
  }

  if (difference === 2) {
    if (first.movement === 'left' && second.movement !== 'left') {
      return { conflict: true, yields: 'first', reference: '13.12' };
    }

    if (second.movement === 'left' && first.movement !== 'left') {
      return { conflict: true, yields: 'second', reference: '13.12' };
    }
  }

  if (junction.control !== 'signals' && difference !== 2) {
    // Approaches are named by where the vehicle comes from, not its heading.
    return { conflict: true, yields: difference === 3 ? 'first' : 'second', reference: '13.11' };
  }

  return { conflict: true, yields: 'neither', reference: null };
}
