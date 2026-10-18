import type { RoadMap } from './model';
import { VEHICLE_LENGTH, VEHICLE_WIDTH } from './model';
import { pointDistance } from './path-geometry';
import { laneOccupation } from './road-context';
import { APPROACH_SIDES, SIDE_VECTOR, movementBetween } from './road-network';

export function validateNetwork(map: RoadMap): void {
  const network = map.network;

  if (!network) {
    return;
  }

  function require(condition: unknown, description: string): asserts condition {
    if (!condition) {
      throw new Error(`Invalid road network: ${description}`);
    }
  }

  const lanes = new Map(network.lanes.map((lane) => [lane.id, lane]));

  const junctions = new Map(network.junctions.map((junction) => [junction.id, junction]));

  const boundaries = new Map(network.boundaries.map((boundary) => [boundary.id, boundary]));

  const all = [
    ...network.lanes,
    ...network.junctions,
    ...network.boundaries,
    ...network.connections,
    ...network.safePositions,
  ];

  require(all.every((item) => item.id) &&
    new Set(all.map((item) => item.id)).size === all.length, 'duplicate or empty ID');
  require(lanes.size > 0 &&
    junctions.size > 0 &&
    network.safePositions.length > 0, 'empty network');

  const validPoint = (point: { x: number; y: number }) =>
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x <= map.width &&
    point.y <= map.height;

  for (const lane of network.lanes) {
    require(validPoint(lane.from) &&
      validPoint(lane.to) &&
      pointDistance(lane.from, lane.to) > VEHICLE_LENGTH, 'lane geometry');
    require(Number.isFinite(lane.width) && lane.width > VEHICLE_WIDTH, 'lane width');
    require(APPROACH_SIDES.includes(lane.approach), 'approach direction');

    const vector = SIDE_VECTOR[lane.approach];

    const length = pointDistance(lane.from, lane.to);

    require(Math.abs((lane.to.x - lane.from.x) / length + vector.x) < 1e-6 &&
      Math.abs((lane.to.y - lane.from.y) / length + vector.y) < 1e-6, 'lane direction');
    require(lane.startJunction === null || junctions.has(lane.startJunction), 'lane start');
    require(lane.endJunction === null || junctions.has(lane.endJunction), 'lane end');

    const opposite = lanes.get(lane.oppositeLaneId);

    require(opposite &&
      opposite.id !== lane.id &&
      opposite.oppositeLaneId === lane.id &&
      opposite.startJunction === lane.endJunction &&
      opposite.endJunction === lane.startJunction &&
      opposite.boundaryId === lane.boundaryId, 'opposite lane');
    require(boundaries.has(lane.boundaryId), 'boundary reference');
    require(lane.speedZoneIds.every((id) =>
      map.speedZones?.some((zone) => zone.id === id),
    ), 'speed reference');
  }

  for (const boundary of network.boundaries) {
    require(validPoint(boundary.from) &&
      validPoint(boundary.to) &&
      pointDistance(boundary.from, boundary.to) > 0 &&
      ['solid', 'double-solid'].includes(boundary.marking) &&
      boundary.reference === '9.1.1', 'boundary geometry');
  }

  for (const junction of network.junctions) {
    require(validPoint(junction) &&
      Number.isFinite(junction.halfSize) &&
      junction.halfSize > 0, 'junction geometry');
    require(['signals', 'priority', 'equal'].includes(junction.control), 'junction control');
    require(junction.approaches.length >= 2 &&
      new Set(junction.approaches.map((a) => a.side)).size ===
        junction.approaches.length, 'junction approaches');
    require(map.intersections?.some(
      (item) => item.id === junction.id && item.x === junction.x && item.y === junction.y,
    ), 'maneuver junction');

    for (const approach of junction.approaches) {
      const incoming = lanes.get(approach.incomingLaneId);

      const outgoing = lanes.get(approach.outgoingLaneId);

      require(incoming &&
        outgoing &&
        incoming.endJunction === junction.id &&
        outgoing.startJunction === junction.id &&
        incoming.approach === approach.side &&
        incoming.oppositeLaneId === outgoing.id, 'approach lane links');
      require(approach.crossingIds.every((id) =>
        map.crossings?.some((crossing) => crossing.id === id),
      ), 'crossing link');
      require(!approach.stopId ||
        map.stops.some((stop) => stop.id === approach.stopId), 'STOP link');
      require(!approach.signalId ||
        map.signals?.some((signal) => signal.id === approach.signalId), 'signal link');
      require(junction.control !== 'signals' || approach.signalId, 'missing signal');
      require(junction.control !== 'priority' ||
        ['main', 'secondary'].includes(approach.priority), 'missing priority');
      require(junction.control === 'priority' ||
        approach.priority === 'equal', 'priority outside signed junction');
      require(approach.sign !== 'stop' || approach.stopId, 'missing STOP');
    }
  }

  const pairs = new Set<string>();

  for (const connection of network.connections) {
    const junction = junctions.get(connection.junctionId);

    const incoming = lanes.get(connection.fromLaneId);

    const outgoing = lanes.get(connection.toLaneId);

    require(junction && incoming && outgoing, 'connection references');

    const entry = junction.approaches.find((a) => a.incomingLaneId === incoming.id);

    const exit = junction.approaches.find((a) => a.outgoingLaneId === outgoing.id);

    require(entry &&
      exit &&
      movementBetween(entry.side, exit.side) === connection.movement, 'incompatible movement');
    require(connection.path.length >= 2 && connection.path.every(validPoint), 'connection path');
    require(pointDistance(connection.path[0], incoming.to) < 1e-6 &&
      pointDistance(connection.path.at(-1)!, outgoing.from) < 1e-6, 'disconnected path endpoints');
    require(connection.path
      .slice(1)
      .every(
        (point, index) =>
          pointDistance(point, connection.path[index]) > 0 &&
          Math.abs(point.x - junction.x) <= junction.halfSize &&
          Math.abs(point.y - junction.y) <= junction.halfSize,
      ), 'path geometry');

    const key = `${incoming.id}:${outgoing.id}`;

    require(!pairs.has(key), 'duplicate movement');
    pairs.add(key);
  }

  for (const junction of network.junctions) {
    for (const entry of junction.approaches) {
      for (const exit of junction.approaches) {
        if (entry.side !== exit.side) {
          require(pairs.has(`${entry.incomingLaneId}:${exit.outgoingLaneId}`), 'missing movement');
        }
      }
    }
  }

  for (const position of network.safePositions) {
    const lane = lanes.get(position.laneId);

    require(lane && validPoint(position) && Number.isFinite(position.heading), 'safe position');
    require(laneOccupation(lane, { ...position, speed: 0, indicator: null, indicatorTurn: 0 })
      .contained &&
      Math.cos(position.heading - Math.atan2(lane.to.y - lane.from.y, lane.to.x - lane.from.x)) >
        0.99, 'unsafe position');
  }

  // Every internal lane must be reachable from every other one without a U-turn.
  const internal = network.lanes.filter((lane) => lane.startJunction && lane.endJunction);

  for (const start of internal) {
    const reachable = new Set([start.id]);

    const queue = [start.id];

    for (const id of queue) {
      for (const connection of network.connections.filter((item) => item.fromLaneId === id)) {
        if (!reachable.has(connection.toLaneId)) {
          reachable.add(connection.toLaneId);
          queue.push(connection.toLaneId);
        }
      }
    }

    require(internal.every((lane) => reachable.has(lane.id)), 'unreachable internal route');
  }
}
