import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { neighborhood } from '../content/maps/neighborhood';
import { localContent } from '../adapters/content/local';
import { IndexedDbHistory } from '../adapters/persistence/indexed-db';
import { bindKeyboard } from '../adapters/input/keyboard';
import { startRuntime } from '../adapters/runtime/loop';
import { GameSession } from '../use-cases/session/game-session';
import { App } from '../presentation/react/App';
import { mountCity } from '../presentation/phaser/city';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '../presentation/react/styles.css';
const session = new GameSession(neighborhood, new IndexedDbHistory(), localContent, {
  id: () => crypto.randomUUID(),
  date: () => new Date().toISOString(),
});
const unbind = bindKeyboard(session),
  stop = startRuntime(session);
const mountWorld = (parent: HTMLElement) => mountCity(parent, session);
const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App session={session} mountWorld={mountWorld} />
  </StrictMode>,
);
void session.initialize();
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unbind();
    stop();
    root.unmount();
  });
}
