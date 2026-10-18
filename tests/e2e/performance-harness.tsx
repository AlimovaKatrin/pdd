import { createRoot } from 'react-dom/client';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { GameSession } from '../../src/use-cases/session/game-session';
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

function samples() {
  const values: number[] = [];

  let count = 0;

  let maximum = 0;

  return {
    add(value: number) {
      values[count % 10000] = value;
      count++;
      maximum = Math.max(maximum, value);
    },
    read() {
      const sorted = [...values].sort((a, b) => a - b);

      return { count, maximum, p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0 };
    },
  };
}

const steps = samples();

const frames = samples();

const session = new GameSession(expandedCity, new IndexedDbHistory(), localContent, {
  id: () => crypto.randomUUID(),
  date: () => new Date().toISOString(),
});

const originalStep = session.step.bind(session);

session.step = () => {
  const start = performance.now();

  originalStep();
  steps.add(performance.now() - start);
};

const unbind = bindKeyboard(session);

const stopRuntime = startRuntime(session);

let root = createRoot(document.getElementById('root')!);

let activeWorlds = 0;

const mountWorld = (parent: HTMLElement) => {
  activeWorlds++;

  const destroy = mountCity(parent, session);

  return () => {
    destroy();
    activeWorlds--;
  };
};

const renderApp = () => root.render(<App session={session} mountWorld={mountWorld} />);

renderApp();
void session.initialize();

let previousFrame = 0;

let frame = 0;

const observeFrames = (time: number) => {
  if (session.isRunning() && previousFrame) {
    frames.add(time - previousFrame);
  }

  previousFrame = session.isRunning() ? time : 0;
  frame = requestAnimationFrame(observeFrames);
};

frame = requestAnimationFrame(observeFrames);

declare global {
  interface Window {
    cityPerf: {
      world: GameSession['getWorld'];
      snapshot: GameSession['getSnapshot'];
      read: () => {
        steps: ReturnType<typeof steps.read>;
        frames: ReturnType<typeof frames.read>;
        activeWorlds: number;
      };
      dispose: () => void;
      remount: () => void;
    };
  }
}

// Diagnostic-only entry: measures the real session and renderer; no world setter or alternative physics.
window.cityPerf = {
  world: () => session.getWorld(),
  snapshot: () => session.getSnapshot(),
  read: () => ({ steps: steps.read(), frames: frames.read(), activeWorlds }),
  remount: () => {
    root.unmount();
    root = createRoot(document.getElementById('root')!);
    renderApp();
  },
  dispose: () => {
    cancelAnimationFrame(frame);
    unbind();
    stopRuntime();
    root.unmount();
  },
};
