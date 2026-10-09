import type { RoadMap } from '../../domain/world/model';
export const neighborhood: RoadMap = {
  version: 'neighborhood-1',
  width: 120,
  height: 100,
  roads: [
    ...[24, 64, 104].map((x) => ({ x: x - 7, y: 11, width: 14, height: 80 })),
    ...[18, 50, 84].map((y) => ({ x: 17, y: y - 7, width: 94, height: 14 })),
  ],
  spawn: { x: 67.5, y: 78, heading: -Math.PI / 2 },
  stops: [
    { id: 'garden-south', a: { x: 64, y: 59 }, b: { x: 71, y: 59 }, direction: { x: 0, y: -1 } },
  ],
};
