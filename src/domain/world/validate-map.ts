import { validateNetwork } from './validate-network';
import type { Point, RoadMap, StopLine } from './model';

export function validateMap(map: RoadMap): RoadMap {
  const positive = (n: number) => Number.isFinite(n) && n > 0;

  const point = (p: Point) =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 0 &&
    p.y >= 0 &&
    p.x <= map.width &&
    p.y <= map.height;

  const direction = (p: Point) => Math.abs(Math.hypot(p.x, p.y) - 1) < 1e-6;

  const line = (s: StopLine) =>
    point(s.a) &&
    point(s.b) &&
    direction(s.direction) &&
    Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y) > 0 &&
    Math.abs((s.b.x - s.a.x) * s.direction.x + (s.b.y - s.a.y) * s.direction.y) < 1e-6;

  const all = [
    map.citySpeedLimit,
    ...map.stops,
    ...(map.speedZones ?? []),
    ...(map.signals ?? []),
    ...(map.crossings ?? []),
    ...(map.intersections ?? []),
  ];

  if (
    !map.version ||
    !map.citySpeedLimit ||
    !positive(map.citySpeedLimit.limit) ||
    map.citySpeedLimit.reference !== '10.2' ||
    !positive(map.width) ||
    !positive(map.height) ||
    !point(map.spawn) ||
    !Number.isFinite(map.spawn.heading) ||
    all.some((o) => !o.id) ||
    new Set(all.map((o) => o.id)).size !== all.length ||
    !map.roads.length ||
    !map.roads.every(
      (r) =>
        point(r) &&
        positive(r.width) &&
        positive(r.height) &&
        point({ x: r.x + r.width, y: r.y + r.height }),
    ) ||
    !map.stops.every(line)
  ) {
    throw new Error('Invalid map geometry');
  }

  if (
    !(map.speedZones ?? []).every(
      (z) =>
        point(z) &&
        positive(z.width) &&
        positive(z.height) &&
        positive(z.limit) &&
        direction(z.direction) &&
        point(z.sign) &&
        point(z.end),
    ) ||
    !(map.signals ?? []).every(
      (s) =>
        line(s.line) &&
        Number.isInteger(s.offset) &&
        s.phases.length > 0 &&
        s.phases.every(
          (p) =>
            ['green', 'yellow', 'red', 'red-yellow'].includes(p.color) &&
            Number.isInteger(p.ticks) &&
            p.ticks > 0,
        ),
    ) ||
    !(map.crossings ?? []).every(
      (c) =>
        line(c.line) &&
        point(c.from) &&
        point(c.to) &&
        Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y) > 0 &&
        positive(c.speed) &&
        (c.label === undefined || (typeof c.label === 'string' && c.label.trim().length > 0)) &&
        Number.isInteger(c.restartTicks) &&
        c.restartTicks > 0 &&
        (c.initialWaitTicks === undefined ||
          (Number.isInteger(c.initialWaitTicks) && c.initialWaitTicks >= 0)) &&
        (!c.signalId ||
          (map.signals?.some((signal) => signal.id === c.signalId) &&
            map.network?.junctions.some(
              (junction) =>
                junction.id === c.junctionId &&
                junction.control === 'signals' &&
                junction.approaches.some((approach) => approach.signalId === c.signalId),
            ) &&
            map.network?.lanes.some(
              (lane) => lane.id === c.outgoingLaneId && lane.startJunction === c.junctionId,
            ))),
    ) ||
    !(map.intersections ?? []).every((j) => point(j) && positive(j.radius))
  ) {
    throw new Error('Invalid traffic configuration');
  }

  validateNetwork(map);

  return map;
}
