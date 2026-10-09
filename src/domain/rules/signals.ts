import type { DetectedViolation, RoadMap, World } from '../world/model';
import { signalColor } from '../world/traffic';
import { cause } from '../violations/causes';
import { crossingFraction, distance, within } from './geometry';

export function checkSignals(previous: World, next: World, map: RoadMap): DetectedViolation[] {
  const events: DetectedViolation[] = [];

  for (const signal of map.signals ?? []) {
    let episode = { ...next.signalEpisodes[signal.id] };

    if (
      episode.phase === 'crossed' &&
      (Math.abs(distance(next.vehicle, signal.line)) > 18 || !within(next.vehicle, signal.line))
    ) {
      episode = { phase: 'ready', stopped: false, number: episode.number + 1 };
    }

    const fraction = crossingFraction(previous.vehicle, next.vehicle, signal.line);

    if (episode.phase === 'ready' && fraction !== null) {
      const color = signalColor(signal, previous.tick + fraction);

      episode.phase = 'crossed';

      if (color === 'red' || color === 'red-yellow') {
        events.push({
          type: 'signal',
          roadObjectId: signal.id,
          episode: episode.number,
          speed: next.vehicle.speed,
          tick: next.tick,
          causes: [cause('red-signal', { signal: color, crossingTick: previous.tick + fraction })],
        });
      }

      if (color === 'yellow') {
        next.advisoryUntil = next.tick + 300;
        next.advisories = [
          'Жёлтый запрещает движение, кроме случая п. 6.14. Возможность остановки без экстренного торможения здесь не оценивается; нарушение автоматически не засчитано.',
        ];
      }
    }

    next.signalEpisodes[signal.id] = episode;
  }

  return events;
}
