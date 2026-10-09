import { describe, expect, it } from 'vitest';
import { neighborhood } from '../../content/maps/neighborhood';
import { initialWorld, type RoadMap, type World } from '../world/model';
import { signalColor, activeSpeedZone } from '../world/traffic';
import { validateMap } from '../world/validate-map';
import { checkSpeed } from './speed';
import { checkSignals } from './signals';
import { checkPedestrians } from './pedestrians';
import { checkTurn } from '../maneuvers/turn';
const map = neighborhood;
describe('speed', () => {
  function world(speed = 30 / 3.6) {
    const w = initialWorld(map);
    w.vehicle = { ...w.vehicle, x: 40, y: 21, heading: 0, speed };
    return w;
  }
  it('accepts the exact limit and detects any excess, once per episode', () => {
    const w = world();
    expect(checkSpeed(w, map)).toEqual([]);
    w.vehicle.speed += 0.001;
    expect(checkSpeed(w, map)).toHaveLength(1);
    expect(checkSpeed(w, map)).toEqual([]);
    w.vehicle.speed = 30 / 3.6;
    expect(checkSpeed(w, map)).toEqual([]);
    w.vehicle.speed = 9;
    expect(checkSpeed(w, map)[0].episode).toBe(2);
  });
  it('uses front bumper at zone start/end and the signed direction', () => {
    const w = world(10);
    w.vehicle.x = 32.89;
    expect(activeSpeedZone(map, w.vehicle)).toBeUndefined();
    w.vehicle.x = 32.9;
    expect(activeSpeedZone(map, w.vehicle)?.limit).toBe(30);
    w.vehicle.x = 54.9;
    expect(activeSpeedZone(map, w.vehicle)).toBeUndefined();
    w.vehicle.x = 40;
    w.vehicle.heading = Math.PI;
    expect(checkSpeed(w, map)).toEqual([]);
  });
  it('rearms on departure and handles another independent sign', () => {
    const second = { ...map.speedZones![0], id: 'another', x: 75 };
    const custom = { ...map, speedZones: [...map.speedZones!, second] };
    const w = world(10);
    checkSpeed(w, custom);
    w.vehicle.x = 70;
    checkSpeed(w, custom);
    w.vehicle.x = 80;
    expect(checkSpeed(w, custom)[0].roadObjectId).toBe('another');
    w.vehicle.x = 40;
    expect(checkSpeed(w, custom)[0].episode).toBe(2);
  });
});
describe('signals', () => {
  const signal = map.signals![0];
  function crossing(tick: number, x = 107.5) {
    const prev = initialWorld(map);
    prev.tick = tick;
    prev.vehicle = { ...prev.vehicle, x, y: 61.2, heading: -Math.PI / 2, speed: 6 };
    const next = structuredClone(prev);
    next.tick++;
    next.vehicle.y = 61;
    return { prev, next };
  }
  it('accepts green, rejects red and red-yellow, leaves yellow as advice', () => {
    for (const [tick, violates] of [
      [0, false],
      [480, false],
      [660, true],
      [1140, true],
    ] as const) {
      const { prev, next } = crossing(tick);
      expect(checkSignals(prev, next, map)).toHaveLength(violates ? 1 : 0);
      if (tick === 480) {
        expect(next.advisories[0]).toContain('6.14');
      }
    }
  });
  it('uses the crossing fraction, with the new phase at its exact start', () => {
    const boundary = {
      ...signal,
      phases: [
        { color: 'green' as const, ticks: 1 },
        { color: 'red' as const, ticks: 1 },
      ],
      offset: 0,
    };
    expect(signalColor(boundary, 0.999)).toBe('green');
    expect(signalColor(boundary, 1)).toBe('red');
    const { prev, next } = crossing(659);
    expect(checkSignals(prev, next, map)).toEqual([]);
    const later = structuredClone(next);
    later.tick = 700;
    later.vehicle.y = 50;
    expect(checkSignals(next, later, map)).toEqual([]);
  });
  it('does not repeat or count adjacent lanes/reverse; rearms for another approach', () => {
    const { prev, next } = crossing(700);
    expect(checkSignals(prev, next, map)).toHaveLength(1);
    expect(checkSignals(prev, next, map)).toEqual([]);
    const away = structuredClone(next);
    away.vehicle.y = 90;
    checkSignals(next, away, map);
    const again = crossing(700);
    again.next.signalEpisodes = away.signalEpisodes;
    expect(checkSignals(again.prev, again.next, map)[0].episode).toBe(2);
    const adjacent = crossing(700, 99);
    expect(checkSignals(adjacent.prev, adjacent.next, map)).toEqual([]);
    const reverse = crossing(700);
    reverse.next.vehicle.speed = -3;
    expect(checkSignals(reverse.prev, reverse.next, map)).toEqual([]);
  });
});
describe('turn geometry and indicators', () => {
  function enter(indicator: 'left' | 'right' | null = null) {
    const prev = initialWorld(map);
    prev.vehicle = { ...prev.vehicle, x: 64, y: 50, heading: 0, speed: 4, indicator };
    const next = structuredClone(prev);
    checkTurn(prev, next, map);
    return next;
  }
  function move(w: World, heading: number, indicator = w.vehicle.indicator, x = w.vehicle.x) {
    const next = structuredClone(w);
    next.tick++;
    next.vehicle = { ...w.vehicle, heading, indicator, x };
    return { next, events: checkTurn(w, next, map) };
  }
  it.each(['left', 'right'] as const)(
    'recognizes %s, preserves signal at a stop, cancels on completion',
    (side) => {
      const sign = side === 'left' ? -1 : 1;
      let w = enter(side);
      w = move(w, 0.1 * sign).next;
      const confirmed = move(w, 0.8 * sign);
      expect(confirmed.events).toEqual([]);
      w = confirmed.next;
      expect(w.maneuver?.direction).toBe(side);
      w.vehicle.speed = 0;
      const stopped = move(w, 0.8 * sign);
      expect(stopped.next.vehicle.indicator).toBe(side);
      w = stopped.next;
      w.vehicle.speed = 4;
      const done = move(w, (Math.PI / 2) * sign, side, 80);
      expect(done.next.vehicle.indicator).toBeNull();
      expect(done.events).toEqual([]);
    },
  );
  it('distinguishes all four causes, deduplicates and starts a new episode', () => {
    let w = enter();
    w = move(w, 0.1).next;
    const missing = move(w, 0.8);
    expect(missing.events[0].causes[0].code).toBe('missing-indicator');
    w = missing.next;
    expect(move(w, 0.85).events).toEqual([]);
    const late = move(w, 0.9, 'right');
    expect(late.events[0].causes[0].code).toBe('late-indicator');
    const early = move(late.next, 1, null);
    expect(early.events[0].causes[0].code).toBe('early-indicator-off');
    const wrong = move(early.next, 1.1, 'left');
    expect(wrong.events[0].causes[0].code).toBe('wrong-indicator');
    w = move(wrong.next, Math.PI / 2, 'left', 80).next;
    w.vehicle.x = 64;
    w = move(w, Math.PI / 2, null).next;
    expect(w.maneuver?.episode).toBe(2);
  });
  it('ignores small corrections, handles late signals before confirmation and aborts reverse', () => {
    let w = enter();
    const correction = move(w, 0.1);
    expect(correction.events).toEqual([]);
    w = correction.next;
    const late = move(w, 0.8, 'right');
    expect(late.events[0].causes.map((c) => c.code)).toEqual([
      'missing-indicator',
      'late-indicator',
    ]);
    w = late.next;
    w.vehicle.speed = -1;
    const reversed = move(w, 1);
    expect(reversed.events).toEqual([]);
    expect(reversed.next.maneuver).toBeNull();
  });
});
describe('pedestrian intention and reaction', () => {
  function encounter(x: number, y: number, speed: number) {
    const prev = initialWorld(map);
    prev.pedestrians['park-crossing'].progress = 0.25;
    prev.vehicle = { ...prev.vehicle, x, y, speed, heading: Math.PI / 2 };
    return { prev, next: structuredClone(prev) };
  }
  it('records forced braking and not proximity or a proper stop before the crossing', () => {
    const blocked = encounter(20.5, 64, 6);
    const events = checkPedestrians(blocked.prev, blocked.next, map, 1 / 60);
    expect(events).toHaveLength(1);
    expect(events[0].causes[0].facts).toMatchObject({
      priority: true,
      actualSpeed: 0,
      reaction: 'braking-for-vehicle',
    });
    expect(blocked.next.pedestrians['park-crossing'].progress).toBe(0.25);
    const yielding = encounter(20.5, 63, 0);
    expect(checkPedestrians(yielding.prev, yielding.next, map, 1 / 60)).toEqual([]);
    expect(yielding.next.pedestrians['park-crossing'].progress).toBeGreaterThan(0.25);
    const near = encounter(27.5, 64, 0);
    expect(checkPedestrians(near.prev, near.next, map, 1 / 60)).toEqual([]);
  });
  it('deduplicates an encounter, rearms after crossing and repeats deterministically', () => {
    const { prev, next } = encounter(20.5, 64, 6);
    checkPedestrians(prev, next, map, 1 / 60);
    const replay = structuredClone(prev);
    checkPedestrians(prev, replay, map, 1 / 60);
    expect(next).toEqual(replay);
    const after = structuredClone(next);
    expect(checkPedestrians(next, after, map, 1 / 60)).toEqual([]);
    after.pedestrians['park-crossing'] = {
      progress: 1,
      waiting: 1,
      episode: 1,
      obstructed: true,
      reaction: null,
    };
    const reset = structuredClone(after);
    checkPedestrians(after, reset, map, 1 / 60);
    expect(reset.pedestrians['park-crossing']).toMatchObject({
      progress: 0,
      episode: 2,
      obstructed: false,
    });
  });
});
it('validates configured geometry, duplicate IDs, empty phase cycles and zero-length paths', () => {
  expect(validateMap(map)).toBe(map);
  const bad: RoadMap = { ...map, signals: [{ ...map.signals![0], phases: [] }] };
  expect(() => validateMap(bad)).toThrow();
  expect(() => validateMap({ ...map, stops: [map.stops[0], map.stops[0]] })).toThrow();
  expect(() =>
    validateMap({ ...map, crossings: [{ ...map.crossings![0], to: map.crossings![0].from }] }),
  ).toThrow();
});
it('signal objects keep independent phases and episodes', () => {
  const original = map.signals![0];
  const other = {
    ...original,
    id: 'other-signal',
    line: { ...original.line, id: 'other-line', a: { x: 64, y: 59 }, b: { x: 71, y: 59 } },
    offset: 700,
  };
  const custom = { ...map, signals: [original, other] },
    prev = initialWorld(custom);
  prev.vehicle = { ...prev.vehicle, x: 67.5, y: 61.2, speed: 5 };
  const next = structuredClone(prev);
  next.tick++;
  next.vehicle.y = 61;
  const events = checkSignals(prev, next, custom);
  expect(events).toHaveLength(1);
  expect(events[0].roadObjectId).toBe('other-signal');
  expect(next.signalEpisodes[original.id].phase).toBe('ready');
});
