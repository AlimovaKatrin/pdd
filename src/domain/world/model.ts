import type { CauseCode, Question, RuleType } from '../learning/question-types';
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
  speedZones?: SpeedZone[];
  signals?: TrafficSignal[];
  intersections?: Intersection[];
  crossings?: Crossing[];
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
  successfulManeuvers: number;
  drivingProgress: {
    speed: Record<string, { valid: boolean }>;
    pedestrians: Record<string, { episode: number; valid: boolean; credited: boolean }>;
  };
  speedEpisodes: Record<string, { active: boolean; number: number }>;
  signalEpisodes: Record<string, StopEpisode>;
  maneuver: Maneuver | null;
  maneuverNumber: number;
  pedestrians: Record<string, PedestrianState>;
  advisories: string[];
  advisoryUntil: number;
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
    successfulManeuvers: 0,
    drivingProgress: { speed: {}, pedestrians: {} },
    speedEpisodes: Object.fromEntries(
      (map.speedZones ?? []).map((z) => [z.id, { active: false, number: 1 }]),
    ),
    signalEpisodes: Object.fromEntries(
      (map.signals ?? []).map((s) => [s.id, { phase: 'ready', stopped: false, number: 1 }]),
    ),
    maneuver: null,
    maneuverNumber: 0,
    pedestrians: Object.fromEntries(
      (map.crossings ?? []).map((c) => [
        c.id,
        { progress: 0, waiting: 0, episode: 1, obstructed: false, reaction: null },
      ]),
    ),
    advisories: [],
    advisoryUntil: 0,
  };
}
export const VEHICLE_LENGTH = 4.2;
export const VEHICLE_WIDTH = 1.8;
export const RULES_VERSION = 'mvp-preview-4';
export interface StopViolation {
  type: 'stop';
  roadObjectId: string;
  episode: number;
  speed: number;
  tick: number;
}
export interface Cause {
  code: CauseCode;
  rule: RuleType;
  title: string;
  explanation: string;
  reference: string;
  referenceUrl?: string;
  facts: Record<string, string | number | boolean>;
}
export interface DetectedViolation {
  type: RuleType;
  roadObjectId: string;
  episode: number;
  speed: number;
  tick: number;
  causes: Cause[];
}
export interface Violation extends DetectedViolation {
  id: string;
  tripId: string;
  attemptId: string;
  date: string;
  mapVersion: string;
  rulesVersion: string;
  eventKeys?: string[];
  material: Question | null;
  materialUnavailable?: string;
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
  schemaVersion: 2;
  violations: Violation[];
  answers: AnswerAttempt[];
  revealed: string[];
  trips: Trip[];
  skips: Skip[];
}
export const emptyHistory = (): History => ({
  schemaVersion: 2,
  violations: [],
  answers: [],
  revealed: [],
  trips: [],
  skips: [],
});

export interface Trip {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: 'active' | 'finished' | 'restarted' | 'interrupted' | 'legacy';
}
export interface Skip {
  id: string;
  violationId: string;
  date: string;
}
export interface SpeedZone extends Road {
  id: string;
  limit: number;
  direction: Point;
  sign: Point;
  end: Point;
}
export type SignalColor = 'green' | 'yellow' | 'red' | 'red-yellow';
export interface TrafficSignal {
  id: string;
  line: StopLine;
  offset: number;
  phases: { color: SignalColor; ticks: number }[];
}
export interface Intersection extends Point {
  id: string;
  radius: number;
}
export interface Maneuver {
  intersectionId: string;
  episode: number;
  entryHeading: number;
  startTick: number;
  initialIndicator: Indicator;
  turning: boolean;
  direction: 'left' | 'right' | null;
  confirmed: boolean;
  signalled: boolean;
  reported: CauseCode[];
}
export interface Crossing {
  id: string;
  line: StopLine;
  from: Point;
  to: Point;
  speed: number;
  restartTicks: number;
}
export interface PedestrianState {
  progress: number;
  waiting: number;
  episode: number;
  obstructed: boolean;
  reaction: 'vehicle' | null;
}
