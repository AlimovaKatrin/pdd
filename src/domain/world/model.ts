export interface Point {
  x: number;
  y: number;
}
export interface Road {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface StopLine {
  id: string;
  a: Point;
  b: Point;
  direction: Point;
}
export interface RoadMap {
  version: string;
  width: number;
  height: number;
  roads: Road[];
  stops: StopLine[];
  spawn: Point & { heading: number };
}
export type Indicator = 'left' | 'right' | null;
export interface Vehicle extends Point {
  heading: number;
  speed: number;
  indicator: Indicator;
  indicatorTurn: number;
}
export interface StopEpisode {
  phase: 'ready' | 'crossed';
  stopped: boolean;
  number: number;
}
export interface World {
  tick: number;
  vehicle: Vehicle;
  stops: Record<string, StopEpisode>;
  successfulStops: number;
}
export interface Controls {
  throttle: boolean;
  reverse: boolean;
  brake: boolean;
  steer: number;
}
export const emptyControls = (): Controls => ({
  throttle: false,
  reverse: false,
  brake: false,
  steer: 0,
});
export function initialWorld(map: RoadMap): World {
  return {
    tick: 0,
    vehicle: { ...map.spawn, speed: 0, indicator: null, indicatorTurn: 0 },
    stops: Object.fromEntries(
      map.stops.map((s) => [s.id, { phase: 'ready', stopped: false, number: 1 }]),
    ),
    successfulStops: 0,
  };
}
export const VEHICLE_LENGTH = 4.2;
export const VEHICLE_WIDTH = 1.8;
export const RULES_VERSION = 'stop-prototype-1';
export interface StopViolation {
  type: 'stop';
  roadObjectId: string;
  episode: number;
  speed: number;
  tick: number;
}
export interface Violation extends StopViolation {
  id: string;
  tripId: string;
  attemptId: string;
  date: string;
  mapVersion: string;
  rulesVersion: string;
}
export interface AnswerAttempt {
  id: string;
  violationId: string;
  questionId: string;
  contentVersion: string;
  answer: number;
  correct: boolean;
  assisted: boolean;
  date: string;
}
export interface History {
  schemaVersion: 1;
  violations: Violation[];
  answers: AnswerAttempt[];
  revealed: string[];
}
export const emptyHistory = (): History => ({
  schemaVersion: 1,
  violations: [],
  answers: [],
  revealed: [],
});
