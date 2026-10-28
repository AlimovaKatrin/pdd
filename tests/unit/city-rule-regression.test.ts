import { expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import {
  initialWorld,
  VEHICLE_LENGTH,
  type StopLine,
  type Vehicle,
} from '../../src/domain/world/model';
import { checkStop } from '../../src/domain/rules/stop';
import { checkSignals } from '../../src/domain/rules/signals';
import { checkTurn } from '../../src/domain/maneuvers/turn';
import { positionAlongPath, pathLength } from '../../src/domain/world/path-geometry';
import { signalColor } from '../../src/domain/world/traffic';

function atLine(line: StopLine, bumperBefore: number, speed = 4): Vehicle {
  return {
    x: (line.a.x + line.b.x) / 2 - line.direction.x * (VEHICLE_LENGTH / 2 + bumperBefore),
    y: (line.a.y + line.b.y) / 2 - line.direction.y * (VEHICLE_LENGTH / 2 + bumperBefore),
    heading: Math.atan2(line.direction.y, line.direction.x),
    speed,
    indicator: null,
    indicatorTurn: 0,
  };
}

it.each(expandedCity.stops)(
  'checks STOP $id independently, including proper stop and rearming',
  (line) => {
    const ready = { phase: 'ready' as const, stopped: false, number: 1 };

    const error = checkStop(atLine(line, 1), atLine(line, -1), line, ready, 1);

    expect(error.violation?.roadObjectId).toBe(line.id);
    expect(
      checkStop(atLine(line, -1), atLine(line, -2), line, error.episode, 2).violation,
    ).toBeUndefined();

    const left = checkStop(atLine(line, -2), atLine(line, 25), line, error.episode, 3);

    expect(
      checkStop(atLine(line, 1), atLine(line, -1), line, left.episode, 4).violation?.episode,
    ).toBe(2);

    const stopped = checkStop(atLine(line, 2), atLine(line, 2, 0), line, ready, 5);

    expect(checkStop(atLine(line, 2, 0), atLine(line, -1), line, stopped.episode, 6).passed).toBe(
      true,
    );
  },
);

it.each(expandedCity.signals!)(
  'checks every signal phase at $id without confusing another lane',
  (signal) => {
    for (let tick = 0; tick < 1800; tick += 60) {
      const before = initialWorld(expandedCity);

      before.tick = tick;
      before.vehicle = atLine(signal.line, 0.1);

      const next = structuredClone(before);

      next.tick++;
      next.vehicle = atLine(signal.line, -0.1);

      const color = signalColor(signal, tick + 0.5);

      const events = checkSignals(before, next, expandedCity);

      expect(events.map((event) => event.roadObjectId)).toEqual(
        color === 'red' || color === 'red-yellow' ? [signal.id] : [],
      );
      expect(checkSignals(before, next, expandedCity)).toEqual([]);
    }
  },
);

it.each(expandedCity.network!.connections)(
  'preserves indicator rules along legal route $id',
  (connection) => {
    const network = expandedCity.network!;

    const incoming = network.lanes.find((item) => item.id === connection.fromLaneId)!;

    const outgoing = network.lanes.find((item) => item.id === connection.toLaneId)!;

    const path = [incoming.from, ...connection.path, outgoing.to];

    for (const signalled of [true, false]) {
      let before = initialWorld(expandedCity);

      before.traffic.vehicles = [];
      Object.assign(before.vehicle, positionAlongPath(path, 0), {
        speed: 4,
        indicator: signalled && connection.movement !== 'straight' ? connection.movement : null,
      });

      const codes: string[] = [];

      for (let distance = 0.5; distance < pathLength(path); distance += 0.5) {
        const next = structuredClone(before);

        next.tick++;
        Object.assign(next.vehicle, positionAlongPath(path, distance));
        codes.push(
          ...checkTurn(before, next, expandedCity).flatMap((event) =>
            event.causes.map((reason) => reason.code),
          ),
        );
        before = next;
      }

      expect(codes).toEqual(
        signalled || connection.movement === 'straight' ? [] : ['missing-indicator'],
      );
    }
  },
);
