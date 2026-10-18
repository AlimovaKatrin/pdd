import { expandedCity } from '../../src/content/maps/expanded-city';

export function signalPedestrianCity() {
  return { ...structuredClone(expandedCity), spawn: { x: 163.5, y: 184, heading: -Math.PI / 2 } };
}
