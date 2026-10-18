import { signalColor } from '../world/traffic';
import type { DetectedViolation, RoadMap, World } from '../world/model';
import { junctionDuty } from '../world/junction-duty';
import { stepTrafficCar } from '../simulation/traffic-car';
import { cause } from '../violations/causes';

/** Attribute only the extra reaction caused by the player, after all ordinary driving constraints. */
export function checkPriority(
  previous: World,
  next: World,
  map: RoadMap,
  stepSeconds: number,
): DetectedViolation[] {
  const passage = previous.junctionPassage;

  const current = next.junctionPassage;

  if (!passage || !current || passage.episode !== current.episode || passage.enteredTick === null) {
    return [];
  }

  const withoutPlayer: World = {
    ...previous,
    vehicle: { ...previous.vehicle, x: -10000, y: -10000, speed: 0 },
    junctionPassage: null,
  };

  const events: DetectedViolation[] = [];

  for (const car of next.traffic.vehicles) {
    if (car.reaction?.participantId !== 'player') {
      continue;
    }

    const before = previous.traffic.vehicles.find((item) => item.id === car.id);

    if (!before) {
      continue;
    }

    const duty = junctionDuty(map, passage, before, previous.tick);

    // Other priority scenarios are enabled after their dedicated acceptance checks.
    if (duty !== 'priority-left-green' || current.reported.includes(duty)) {
      continue;
    }

    const unimpeded = stepTrafficCar(before, withoutPlayer, map, stepSeconds);

    if (unimpeded.vehicle.speed - car.vehicle.speed <= 1e-6) {
      continue;
    }

    const connection = map.network!.connections.find((item) => item.id === before.connectionId)!;

    const playerConnection = map.network!.connections.find(
      (item) => item.id === passage.connectionId,
    )!;

    const junction = map.network!.junctions.find((item) => item.id === passage.junctionId)!;

    const approach = junction.approaches.find(
      (item) => item.incomingLaneId === connection.fromLaneId,
    )!;

    const signal = map.signals?.find((item) => item.id === approach.signalId);

    current.reported.push(duty);
    events.push({
      type: 'priority',
      roadObjectId: passage.junctionId,
      episode: passage.episode,
      tick: next.tick,
      speed: next.vehicle.speed,
      causes: [
        cause(duty, {
          participantId: car.id,
          participantLabel: car.label,
          participantMovement: connection.movement,
          playerMovement: playerConnection.movement,
          playerFrom: junction.approaches.find(
            (item) => item.incomingLaneId === passage.incomingLaneId,
          )!.side,
          participantFrom: junction.approaches.find(
            (item) => item.incomingLaneId === connection.fromLaneId,
          )!.side,
          playerSignal: passage.entrySignal ?? 'unregulated',
          participantSignal:
            before.entrySignal ?? (signal ? signalColor(signal, previous.tick) : 'unregulated'),
          control: junction.control,
          participantSign: approach.sign ?? 'none',
          previousSpeedKmh: before.vehicle.speed * 3.6,
          actualSpeedKmh: car.vehicle.speed * 3.6,
          unimpededSpeedKmh: unimpeded.vehicle.speed * 3.6,
          reaction: 'player-obstruction',
        }),
      ],
    });
  }

  return events;
}
