import {
  VEHICLE_LENGTH,
  VEHICLE_WIDTH,
  type Point,
  type StopLine,
  type Vehicle,
} from '../world/model';
export const front = (v: Vehicle): Point => ({
  x: v.x + (Math.cos(v.heading) * VEHICLE_LENGTH) / 2,
  y: v.y + (Math.sin(v.heading) * VEHICLE_LENGTH) / 2,
});
export function distance(v: Vehicle, line: StopLine) {
  const p = front(v);
  return (line.a.x - p.x) * line.direction.x + (line.a.y - p.y) * line.direction.y;
}
export function within(v: Vehicle, line: StopLine) {
  const p = front(v),
    dx = line.b.x - line.a.x,
    dy = line.b.y - line.a.y,
    len = Math.hypot(dx, dy);
  const along = ((p.x - line.a.x) * dx + (p.y - line.a.y) * dy) / len;
  return along >= -VEHICLE_WIDTH / 2 && along <= len + VEHICLE_WIDTH / 2;
}
export function crossingFraction(previous: Vehicle, next: Vehicle, line: StopLine): number | null {
  const before = distance(previous, line),
    after = distance(next, line);
  if (
    before < 0 ||
    after >= 0 ||
    next.speed <= 0 ||
    Math.cos(next.heading) * line.direction.x + Math.sin(next.heading) * line.direction.y <= 0.5
  ) {
    return null;
  }
  const fraction = before / (before - after);
  const p = front(previous),
    n = front(next),
    point = { x: p.x + (n.x - p.x) * fraction, y: p.y + (n.y - p.y) * fraction };
  const dx = line.b.x - line.a.x,
    dy = line.b.y - line.a.y,
    len = Math.hypot(dx, dy),
    lateral = ((point.x - line.a.x) * dx + (point.y - line.a.y) * dy) / len;
  return lateral >= -VEHICLE_WIDTH / 2 && lateral <= len + VEHICLE_WIDTH / 2 ? fraction : null;
}
