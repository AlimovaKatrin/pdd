import { signalPedestrianCity } from '../fixtures/signal-pedestrian-city';
import { equalRoadCity } from '../fixtures/equal-road-city';
import { mainRoadCity, priorityCity } from '../fixtures/priority-city';
import type { Vehicle } from '../../src/domain/world/model';
import { createRoot } from 'react-dom/client';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { GameSession, type SessionSnapshot } from '../../src/use-cases/session/game-session';
import { IndexedDbHistory } from '../../src/adapters/persistence/indexed-db';
import { localContent } from '../../src/adapters/content/local';
import { bindKeyboard } from '../../src/adapters/input/keyboard';
import { startRuntime } from '../../src/adapters/runtime/loop';
import { App } from '../../src/presentation/react/App';
import { mountCity } from '../../src/presentation/phaser/city';
import '../../src/presentation/react/styles.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';

declare global {
  interface Window {
    cityTest: {
      pose: () => Readonly<Vehicle>;
      world: GameSession['getWorld'];
      snapshot: () => SessionSnapshot;
      pause: () => void;
      returnToRoad: () => void;
    };
  }
}

const parameters = new URLSearchParams(location.search);

let map = expandedCity;

if (parameters.has('collision')) {
  map = { ...expandedCity, spawn: { x: 162, y: 43.5, heading: Math.PI } };
} else if (parameters.has('signal-pedestrian')) {
  map = signalPedestrianCity();
} else if (parameters.has('equal-road')) {
  map = equalRoadCity();
} else if (parameters.has('main-road')) {
  map = mainRoadCity();
} else if (parameters.has('priority')) {
  map = priorityCity();
}

const block = parameters.get('block');

if (block === 'north-east') {
  map = { ...map, spawn: { x: 163.5, y: 100, heading: -Math.PI / 2 } };
} else if (block === 'south-west') {
  map = { ...map, spawn: { x: 43.5, y: 240, heading: -Math.PI / 2 } };
}

const session = new GameSession(map, new IndexedDbHistory(), localContent, {
  id: () => crypto.randomUUID(),
  date: () => new Date().toISOString(),
});

bindKeyboard(session);
startRuntime(session);
createRoot(document.getElementById('root')!).render(
  <App session={session} mountWorld={(parent) => mountCity(parent, session)} />,
);
void session.initialize();

// A read-only test fixture, served by Vite only from tests/. Not part of the production entry.
window.cityTest = {
  pose: () => session.getWorld().vehicle,
  world: () => session.getWorld(),
  snapshot: () => session.getSnapshot(),
  pause: () => session.pause('manual'),
  returnToRoad: () => session.returnToRoad(),
};
