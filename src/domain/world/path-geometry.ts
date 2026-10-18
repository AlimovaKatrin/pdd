import type { Point } from './point';

export function pointDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function projectOnSegment(point: Point, from: Point, to: Point) {
  const dx = to.x - from.x;

  const dy = to.y - from.y;

  const length = Math.hypot(dx, dy);

  if (length === 0) {
    throw new Error('A road segment must have positive length');
  }

  const along = ((point.x - from.x) * dx + (point.y - from.y) * dy) / length;

  const lateral = ((point.y - from.y) * dx - (point.x - from.x) * dy) / length;

  return { along, lateral, length };
}

export function distanceToSegment(point: Point, from: Point, to: Point) {
  const { along, lateral, length } = projectOnSegment(point, from, to);

  if (along < 0) {
    return pointDistance(point, from);
  }

  if (along > length) {
    return pointDistance(point, to);
  }

  return Math.abs(lateral);
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const ab = { x: b.x - a.x, y: b.y - a.y };

  const cd = { x: d.x - c.x, y: d.y - c.y };

  const determinant = ab.x * cd.y - ab.y * cd.x;

  if (Math.abs(determinant) < 1e-9) {
    return Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d)) < 1e-9;
  }

  const offset = { x: c.x - a.x, y: c.y - a.y };

  const first = (offset.x * cd.y - offset.y * cd.x) / determinant;

  const second = (offset.x * ab.y - offset.y * ab.x) / determinant;

  return first >= 0 && first <= 1 && second >= 0 && second <= 1;
}

/** Occupied widths matter, not just intersection of the centre lines. */
export function pathsConflict(
  first: readonly Point[],
  second: readonly Point[],
  clearance: number,
) {
  for (let i = 1; i < first.length; i++) {
    for (let j = 1; j < second.length; j++) {
      const a = first[i - 1];

      const b = first[i];

      const c = second[j - 1];

      const d = second[j];

      if (
        segmentsIntersect(a, b, c, d) ||
        Math.min(
          distanceToSegment(a, c, d),
          distanceToSegment(b, c, d),
          distanceToSegment(c, a, b),
          distanceToSegment(d, a, b),
        ) < clearance
      ) {
        return true;
      }
    }
  }

  return false;
}

export function pathLength(path: readonly Point[]): number {
  return path.slice(1).reduce((sum, point, i) => sum + pointDistance(path[i], point), 0);
}

export function positionAlongPath(path: readonly Point[], distance: number) {
  let remaining = Math.max(0, distance);

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];

    const to = path[i];

    const length = pointDistance(from, to);

    if (remaining <= length || i === path.length - 1) {
      const fraction = Math.min(1, remaining / length);

      return {
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
        heading: Math.atan2(to.y - from.y, to.x - from.x),
      };
    }

    remaining -= length;
  }

  throw new Error('A road path needs at least two points');
}
