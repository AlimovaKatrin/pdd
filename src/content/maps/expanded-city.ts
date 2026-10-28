import type { RoadMap, StopLine, TrafficSignal } from '../../domain/world/model';
import { SIDE_VECTOR, type JunctionApproach } from '../../domain/world/road-network';
import { CITY_STREETS, createCityNetwork } from './city-network';

const network = createCityNetwork();

const centralJunction = network.junctions.find((item) => item.control === 'signals')!;

function approachLine(approach: JunctionApproach, id: string): StopLine {
  const lane = network.lanes.find((item) => item.id === approach.incomingLaneId)!;

  const outward = SIDE_VECTOR[approach.side];

  const point = { x: lane.to.x + outward.x, y: lane.to.y + outward.y };

  return {
    id,
    a: { x: point.x - outward.y * 3.5, y: point.y + outward.x * 3.5 },
    b: { x: point.x + outward.y * 3.5, y: point.y - outward.x * 3.5 },
    direction: { x: -outward.x, y: -outward.y },
  };
}

const phases: TrafficSignal['phases'] = [
  { color: 'green', ticks: 600 },
  { color: 'yellow', ticks: 180 },
  { color: 'red', ticks: 900 },
  { color: 'red-yellow', ticks: 120 },
];

const signedLane = network.lanes.find((lane) => lane.from.x === 54 && lane.from.y === 43.5)!;

signedLane.speedZoneIds.push('city-park-30');

export const expandedCity: RoadMap = {
  version: 'four-blocks-2',
  width: 320,
  height: 320,
  roads: [
    ...CITY_STREETS.map((x) => ({ x: x - 7, y: 12, width: 14, height: 296 })),
    ...CITY_STREETS.map((y) => ({ x: 12, y: y - 7, width: 296, height: 14 })),
  ],
  network,
  spawn: { x: 163.5, y: 220, heading: -Math.PI / 2 },
  citySpeedLimit: { id: 'city-60', limit: 60, reference: '10.2' },
  stops: network.junctions.flatMap((junction) =>
    junction.approaches
      .filter((a) => a.stopId)
      .map((approach) => approachLine(approach, approach.stopId!)),
  ),
  signals: network.junctions.flatMap((junction) =>
    junction.approaches
      .filter((a) => a.signalId)
      .map((approach) => ({
        id: approach.signalId!,
        line: approachLine(approach, `${approach.signalId!}-line`),
        // All-red clearance before the other axis receives green; both cycles total 1800 ticks.
        offset: approach.side === 'north' || approach.side === 'south' ? 0 : 900,
        phases: structuredClone(phases),
      })),
  ),
  intersections: network.junctions.map((junction) => ({
    id: junction.id,
    x: junction.x,
    y: junction.y,
    radius: 20,
  })),
  speedZones: [
    {
      id: 'city-park-30',
      x: 68,
      y: 40,
      width: 78,
      height: 7,
      limit: 30,
      direction: { x: 1, y: 0 },
      sign: { x: 68, y: 47 },
      end: { x: 146, y: 47 },
    },
  ],
  crossings: [
    {
      id: 'city-central-crossing',
      label: 'П1',
      line: {
        id: 'city-central-yield',
        a: { x: 153, y: 175 },
        b: { x: 167, y: 175 },
        direction: { x: 0, y: -1 },
      },
      from: { x: 153, y: 172 },
      to: { x: 167, y: 172 },
      speed: 1.2,
      restartTicks: 600,
      initialWaitTicks: 1400,
      signalId: centralJunction.approaches.find((item) => item.side === 'east')!.signalId,
      junctionId: centralJunction.id,
      outgoingLaneId: centralJunction.approaches.find((item) => item.side === 'south')!
        .outgoingLaneId,
    },
    {
      id: 'city-park-crossing',
      line: {
        id: 'city-park-yield',
        a: { x: 33, y: 217 },
        b: { x: 47, y: 217 },
        direction: { x: 0, y: 1 },
      },
      from: { x: 33, y: 220 },
      to: { x: 47, y: 220 },
      speed: 1.2,
      restartTicks: 600,
    },
  ],
};

network.junctions
  .find((junction) => junction.id === 'city-40-280')!
  .approaches.find((approach) => approach.side === 'north')!
  .crossingIds.push('city-park-crossing');

centralJunction.approaches
  .find((item) => item.side === 'south')!
  .crossingIds.push('city-central-crossing');
