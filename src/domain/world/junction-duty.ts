import type { CauseCode } from '../learning/question';
import type { RoadMap, SignalColor } from './model';
import { compareJunctionPaths } from './junction-priority';
import { greenStartedAt, signalColor } from './traffic';

export interface JunctionParticipant {
  connectionId: string;
  enteredTick: number | null;
  entrySignal: SignalColor | null;
}

/** The duty is shared by traffic and player detection; it does not itself prove obstruction. */
export function junctionDuty(
  map: RoadMap,
  first: JunctionParticipant,
  second: JunctionParticipant,
  tick: number,
): CauseCode | null {
  const network = map.network;

  const a = network?.connections.find((item) => item.id === first.connectionId);

  const b = network?.connections.find((item) => item.id === second.connectionId);

  if (!a || !b || a.junctionId !== b.junctionId) {
    return null;
  }

  const junction = network!.junctions.find((item) => item.id === a.junctionId)!;

  const relation = compareJunctionPaths(junction, a, b);

  if (!relation.conflict || relation.yields === 'queue') {
    return null;
  }

  if (junction.control === 'signals') {
    const entryA = junction.approaches.find((item) => item.incomingLaneId === a.fromLaneId)!;

    const entryB = junction.approaches.find((item) => item.incomingLaneId === b.fromLaneId)!;

    const signalA = map.signals!.find((item) => item.id === entryA.signalId)!;

    const signalB = map.signals!.find((item) => item.id === entryB.signalId)!;

    const firstColor = first.enteredTick === null ? signalColor(signalA, tick) : first.entrySignal;

    const secondColor =
      second.enteredTick === null ? signalColor(signalB, tick) : second.entrySignal;

    if (firstColor !== 'green') {
      return null;
    }

    const started = greenStartedAt(signalA, tick);

    if (
      started !== null &&
      second.enteredTick !== null &&
      second.enteredTick < started &&
      (first.enteredTick === null || first.enteredTick >= started)
    ) {
      return 'priority-clearing';
    }

    if (secondColor === 'green' && relation.yields === 'first' && relation.reference === '13.4') {
      return 'priority-left-green';
    }

    return null;
  }

  if (relation.yields !== 'first') {
    return null;
  }

  switch (relation.reference) {
    case '13.9':
      return 'priority-main';
    case '13.11':
      return 'priority-right';
    case '13.12':
      return 'priority-left-equal';
    default:
      return null;
  }
}
