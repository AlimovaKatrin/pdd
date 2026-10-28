import type { Point } from './point';

export type Indicator = 'left' | 'right' | null;

export interface Vehicle extends Point {
  heading: number;
  speed: number;
  indicator: Indicator;
  indicatorTurn: number;
}

export const VEHICLE_LENGTH = 4.2;

export const VEHICLE_WIDTH = 1.8;

export interface TrafficReaction {
  reason: 'signal' | 'stop' | 'pedestrian' | 'vehicle' | 'priority' | 'boundary';
  participantId?: string;
  reference?: string;
  junctionId?: string;
}

export interface TrafficVehicle {
  id: string;
  label: string;
  vehicle: Vehicle;
  laneId: string;
  connectionId: string;
  segment: 'lane' | 'junction';
  distance: number;
  stopped: boolean;
  waitingTicks: number;
  reaction: TrafficReaction | null;
  enteredTick: number | null;
  entrySignal: 'green' | 'yellow' | 'red' | 'red-yellow' | null;
}

export interface TrafficState {
  vehicles: TrafficVehicle[];
  seed: number;
  nextId: number;
  nextSpawnTick: number;
}
