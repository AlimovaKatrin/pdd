import type { CauseCode, Question, RuleType } from '../learning/question-types';

import type { Vehicle, TrafficState, Indicator } from './vehicles';
import { createTraffic } from './traffic-state';

export { VEHICLE_LENGTH, VEHICLE_WIDTH } from './vehicles';

export type { Vehicle, Indicator } from './vehicles';

import type { Point } from './point';
import type { RoadNetwork } from './road-network';

export type { Point } from './point';

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
  network?: RoadNetwork;
  stops: StopLine[];
  spawn: Point & { heading: number };
  citySpeedLimit: { id: string; limit: number; reference: '10.2' };
  speedZones?: SpeedZone[];
  signals?: TrafficSignal[];
  intersections?: Intersection[];
  crossings?: Crossing[];
}

export interface StopEpisode {
  phase: 'ready' | 'crossed';
  stopped: boolean;
  number: number;
}

export interface JunctionPassage {
  junctionId: string;
  incomingLaneId: string;
  connectionId: string;
  entryHeading: number;
  enteredTick: number | null;
  entrySignal: SignalColor | null;
  episode: number;
  reported: string[];
}

export interface World {
  tick: number;
  relocation: number;
  vehicle: Vehicle;
  traffic: TrafficState;
  stops: Record<string, StopEpisode>;
  successfulManeuvers: number;
  drivingProgress: {
    speed: Record<string, { valid: boolean }>;
    pedestrians: Record<string, { episode: number; valid: boolean; credited: boolean }>;
  };
  junctionPassage: JunctionPassage | null;
  passageNumber: number;
  oncomingEpisode: { active: boolean; number: number };
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
    relocation: 0,
    traffic: createTraffic(map.network, map.spawn),
    vehicle: { ...map.spawn, speed: 0, indicator: null, indicatorTurn: 0 },
    stops: Object.fromEntries(
      map.stops.map((s) => [s.id, { phase: 'ready', stopped: false, number: 1 }]),
    ),
    successfulManeuvers: 0,
    drivingProgress: { speed: {}, pedestrians: {} },
    junctionPassage: null,
    passageNumber: 0,
    oncomingEpisode: { active: false, number: 1 },
    speedEpisodes: Object.fromEntries(
      [map.citySpeedLimit, ...(map.speedZones ?? [])].map((zone) => [
        zone.id,
        { active: false, number: 1 },
      ]),
    ),
    signalEpisodes: Object.fromEntries(
      (map.signals ?? []).map((s) => [s.id, { phase: 'ready', stopped: false, number: 1 }]),
    ),
    maneuver: null,
    maneuverNumber: 0,
    pedestrians: Object.fromEntries(
      (map.crossings ?? []).map((c) => [
        c.id,
        {
          progress: 0,
          waiting: c.initialWaitTicks ?? 0,
          episode: 1,
          obstructed: false,
          reaction: null,
          startedTick: null,
        },
      ]),
    ),
    advisories: [],
    advisoryUntil: 0,
  };
}

export const RULES_VERSION = 'city-preview-1';

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
  referenceCheckedOn?: string;
  additionalReferences?: { label: string; url: string }[];
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
  valid: boolean;
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
  label?: string;
  line: StopLine;
  from: Point;
  to: Point;
  speed: number;
  restartTicks: number;
  initialWaitTicks?: number;
  signalId?: string;
  junctionId?: string;
  outgoingLaneId?: string;
}

export interface PedestrianState {
  progress: number;
  waiting: number;
  episode: number;
  obstructed: boolean;
  reaction: 'vehicle' | null;
  startedTick?: number | null;
}
