import { crossingFraction } from '../rules/geometry';
import type { RoadMap, World } from './model';
import { VEHICLE_LENGTH } from './model';
import { laneAt, laneOccupation } from './road-context';
import { angleDifference, signalColor } from './traffic';
import { projectOnSegment } from './path-geometry';
import type { Movement } from './road-network';

const APPROACH_DISTANCE_METERS = 35;

const ABANDON_APPROACH_DISTANCE_METERS = 40;

const EXIT_MARGIN_METERS = 12;

const TURN_ANGLE_RADIANS = 0.2;

/** Own the entry context independently of the car's current position and turn indicator. */
export function updatePlayerPassage(previous: World, next: World, map: RoadMap): void {
  const network = map.network;

  if (!network) {
    return;
  }

  let passage = previous.junctionPassage ? structuredClone(previous.junctionPassage) : null;

  const currentLane = laneAt(network, next.vehicle);

  if (passage && passage.enteredTick !== null) {
    const junctionId = passage.junctionId;

    const junction = network.junctions.find((item) => item.id === junctionId)!;

    if (
      Math.hypot(next.vehicle.x - junction.x, next.vehicle.y - junction.y) >
      junction.halfSize + EXIT_MARGIN_METERS
    ) {
      passage = null;
    }
  }

  if (
    passage &&
    currentLane?.startJunction === passage.junctionId &&
    laneOccupation(currentLane, next.vehicle).contained
  ) {
    passage = null;
  }

  if (!passage && currentLane?.endJunction) {
    const heading = Math.atan2(
      currentLane.to.y - currentLane.from.y,
      currentLane.to.x - currentLane.from.x,
    );

    const projection = projectOnSegment(next.vehicle, currentLane.from, currentLane.to);

    if (
      Math.cos(next.vehicle.heading - heading) > 0.8 &&
      projection.length - projection.along < APPROACH_DISTANCE_METERS
    ) {
      const connection = network.connections.find(
        (item) => item.fromLaneId === currentLane.id && item.movement === 'straight',
      )!;

      next.passageNumber++;
      passage = {
        junctionId: currentLane.endJunction,
        incomingLaneId: currentLane.id,
        connectionId: connection.id,
        entryHeading: heading,
        enteredTick: null,
        entrySignal: null,
        episode: next.passageNumber,
        reported: [],
      };
    }
  }

  next.junctionPassage = passage;

  if (!passage) {
    return;
  }

  const lane = network.lanes.find((item) => item.id === passage.incomingLaneId)!;

  const before = projectOnSegment(previous.vehicle, lane.from, lane.to);

  const after = projectOnSegment(next.vehicle, lane.from, lane.to);

  const entryDistance = before.length - VEHICLE_LENGTH / 2;

  const approach = network.junctions
    .find((item) => item.id === passage.junctionId)!
    .approaches.find((item) => item.incomingLaneId === lane.id)!;

  const signal = map.signals?.find((item) => item.id === approach.signalId);

  const signalFraction = signal
    ? crossingFraction(previous.vehicle, next.vehicle, signal.line)
    : null;

  if (passage.enteredTick === null && signal && signalFraction !== null) {
    passage.entrySignal = signalColor(signal, previous.tick + signalFraction);
  }

  if (
    passage.enteredTick === null &&
    before.along <= entryDistance &&
    after.along > entryDistance
  ) {
    const fraction = (entryDistance - before.along) / (after.along - before.along);

    passage.enteredTick = previous.tick + fraction;
    passage.entrySignal ??= signal ? signalColor(signal, passage.enteredTick) : null;
  }

  const turn = angleDifference(next.vehicle.heading, passage.entryHeading);

  let movement: Movement = 'straight';

  if (passage.enteredTick !== null && Math.abs(turn) > TURN_ANGLE_RADIANS) {
    movement = turn < 0 ? 'left' : 'right';
  }

  passage.connectionId = network.connections.find(
    (item) => item.fromLaneId === lane.id && item.movement === movement,
  )!.id;

  // Backing away before entry abandons the approach; a later approach receives a new episode.
  if (
    passage.enteredTick === null &&
    after.length - after.along > ABANDON_APPROACH_DISTANCE_METERS
  ) {
    next.junctionPassage = null;
  }
}
