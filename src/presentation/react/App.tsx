import { useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import type { GameSession } from '../../use-cases/session/game-session';
import { AppHeader } from './AppHeader';
import { CityGuide } from './CityGuide';
import { Dashboard } from './Dashboard';
import { DrivingHelp } from './DrivingHelp';
import { GameMap } from './GameMap';
import { SessionStatus } from './SessionStatus';
import { TripOverlays } from './TripOverlays';
import { TripProgress } from './TripProgress';

interface AppProps {
  session: GameSession;
  mountWorld: (parent: HTMLElement) => () => void;
}

export function App({ session, mountWorld }: AppProps) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);

  const tripViolationCount = state.history.violations.filter(
    (violation) => violation.tripId === state.activeTripId,
  ).length;

  const openJournal = () => session.openJournal();

  const runAndFocusRoad = (action: () => void) => {
    action();

    const { journal, current } = session.getSnapshot();

    if (journal || current) {
      return;
    }

    requestAnimationFrame(() => document.getElementById('road')?.focus());
  };

  return (
    <div className="app">
      <AppHeader
        journalOpen={state.journal}
        violationCount={state.history.violations.length}
        onShowTrip={() => runAndFocusRoad(() => session.closeJournal())}
        onOpenJournal={openJournal}
      />
      <main>
        <div className="page-title">
          <div>
            <div className="eyebrow">МАЛЕНЬКИЕ ПОЕЗДКИ. БОЛЬШЕ УВЕРЕННОСТИ.</div>
            <h1>Правила становятся опытом.</h1>
            <p>Исследуйте город, пробуйте и разбирайтесь в дорожных ситуациях.</p>
          </div>
          <span className="edition">
            01<span>/ СВОБОДНАЯ ПОЕЗДКА</span>
          </span>
        </div>
        <div className="game-layout">
          <div className="driving-area">
            <GameMap mountWorld={mountWorld} expanded={!!session.map.network} />
            <Dashboard state={state} session={session} act={runAndFocusRoad} />
          </div>
          <aside className="sidebar">
            <CityGuide expanded={!!session.map.network} />
            <DrivingHelp />
            <TripProgress
              successfulManeuvers={state.driving.successfulManeuvers}
              violationCount={tripViolationCount}
              onOpenJournal={openJournal}
            />
          </aside>
        </div>
        <SessionStatus
          storage={state.storage}
          notice={state.notice}
          advisory={state.driving.advisory}
        />
      </main>
      <TripOverlays state={state} session={session} runAndFocusRoad={runAndFocusRoad} />
      <div className="mobile-banner">
        <X size={16} />
        Для управления нужен компьютер с клавиатурой.
      </div>
    </div>
  );
}
