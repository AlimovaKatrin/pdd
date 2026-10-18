import type { ReadonlyData } from './read-only';
import type { CauseCode } from '../learning/question';
import type { Crossing, PedestrianState, RoadMap, World } from './model';
import { greenStartedAt, signalColor } from './traffic';

export function pedestrianMayStart(
  crossing: Crossing,
  map: ReadonlyData<RoadMap>,
  tick: number,
): boolean {
  if (!crossing.signalId) {
    return true;
  }

  const signal = map.signals!.find((item) => item.id === crossing.signalId)!;

  return signalColor(signal, tick) === 'green';
}

/** Legal duty is distinct from a pedestrian's defensive reaction to any approaching vehicle. */
export function pedestrianDuty(
  crossing: Crossing,
  pedestrian: PedestrianState,
  world: World,
  map: RoadMap,
): CauseCode | null {
  if (!crossing.signalId) {
    return 'pedestrian-obstruction';
  }

  const passage = world.junctionPassage;

  if (!passage || passage.junctionId !== crossing.junctionId) {
    return null;
  }

  const connection = map.network!.connections.find((item) => item.id === passage.connectionId)!;

  if (connection.movement !== 'straight' && connection.toLaneId === crossing.outgoingLaneId) {
    return 'pedestrian-turn';
  }

  const junction = map.network!.junctions.find((item) => item.id === passage.junctionId)!;

  const approach = junction.approaches.find(
    (item) => item.incomingLaneId === passage.incomingLaneId,
  )!;

  const signal = map.signals!.find((item) => item.id === approach.signalId)!;

  const greenStart = greenStartedAt(signal, world.tick);

  if (
    greenStart !== null &&
    pedestrian.progress > 0 &&
    pedestrian.progress < 1 &&
    typeof pedestrian.startedTick === 'number' &&
    pedestrian.startedTick < greenStart &&
    (passage.enteredTick === null || passage.enteredTick >= greenStart)
  ) {
    return 'pedestrian-clearing';
  }

  return null;
}
