import type { RoadMap } from '../../domain/world/model';

export const neighborhood: RoadMap = {
  version: 'neighborhood-2',
  width: 120,
  height: 100,
  roads: [
    ...[24, 64, 104].map((x) => ({ x: x - 7, y: 11, width: 14, height: 80 })),
    ...[18, 50, 84].map((y) => ({ x: 17, y: y - 7, width: 94, height: 14 })),
  ],
  spawn: { x: 67.5, y: 78, heading: -Math.PI / 2 },
  speedZones: [
    {
      id: 'east-30',
      x: 35,
      y: 18,
      width: 22,
      height: 7,
      limit: 30,
      direction: { x: 1, y: 0 },
      sign: { x: 35, y: 25 },
      end: { x: 57, y: 25 },
    },
  ],
  signals: [
    {
      id: 'workshop-north',
      line: {
        id: 'workshop-line',
        a: { x: 104, y: 59 },
        b: { x: 111, y: 59 },
        direction: { x: 0, y: -1 },
      },
      offset: 0,
      phases: [
        { color: 'green', ticks: 480 },
        { color: 'yellow', ticks: 180 },
        { color: 'red', ticks: 480 },
        { color: 'red-yellow', ticks: 120 },
      ],
    },
  ],
  intersections: [24, 64, 104].flatMap((x) =>
    [18, 50, 84].map((y) => ({ id: `junction-${x}-${y}`, x, y, radius: 11 })),
  ),
  crossings: [
    {
      id: 'park-crossing',
      line: {
        id: 'park-yield',
        a: { x: 17, y: 64 },
        b: { x: 31, y: 64 },
        direction: { x: 0, y: 1 },
      },
      from: { x: 17, y: 67 },
      to: { x: 31, y: 67 },
      speed: 1.2,
      restartTicks: 300,
    },
  ],
  stops: [
    { id: 'garden-south', a: { x: 64, y: 59 }, b: { x: 71, y: 59 }, direction: { x: 0, y: -1 } },
  ],
};
