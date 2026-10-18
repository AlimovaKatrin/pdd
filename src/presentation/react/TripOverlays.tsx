import { ArrowRight, Leaf, Pause, Play } from 'lucide-react';
import type { GameSession, SessionSnapshot } from '../../use-cases/session/game-session';
import { Incident } from './Incident';
import { Journal } from './Journal';

function PauseCard({ onResume }: { onResume: () => void }) {
  return (
    <div className="pause-card">
      <Pause size={25} />
      <h2>Небольшая остановка</h2>
      <p>Город подождёт. Продолжайте, когда будете готовы.</p>
      <button className="primary" onClick={onResume}>
        Продолжить поездку <Play size={16} />
      </button>
    </div>
  );
}

function WelcomeCard({
  ready,
  onStart,
  expanded,
}: {
  ready: boolean;
  onStart: () => void;
  expanded: boolean;
}) {
  return (
    <div className="welcome">
      <span className="welcome-icon">
        <Leaf size={23} />
      </span>
      <h2>Хорошее место для первой поездки</h2>
      <p>
        {expanded
          ? 'Исследуйте четыре квартала. Впереди центральный светофор, по соседним улицам можно объехать город.'
          : 'Впереди знак STOP. Попробуйте остановиться перед линией — или узнайте, что случится, если проехать.'}
      </p>
      <button className="primary" disabled={!ready} onClick={onStart}>
        <Play size={17} />
        {ready ? 'Поехать в город' : 'Загружаем историю…'}
        <ArrowRight size={17} />
      </button>
      <span className="desktop-note">Клавиатура · Chrome/Edge · окно от 1024×650</span>
      <span className="desktop-note">
        {expanded
          ? 'Предпросмотр расширенного города. Это не полный экзамен ПДД.'
          : 'Пять групп правил, без других машин. Это не полный экзамен ПДД.'}
      </span>
    </div>
  );
}

interface TripOverlaysProps {
  state: SessionSnapshot;
  session: GameSession;
  runAndFocusRoad: (action: () => void) => void;
}

export function TripOverlays({ state, session, runAndFocusRoad }: TripOverlaysProps) {
  const showPause = state.started && state.pauses.length > 0 && !state.current && !state.journal;

  return (
    <>
      {showPause && <PauseCard onResume={() => runAndFocusRoad(() => session.resume())} />}
      {!state.started && (
        <WelcomeCard
          expanded={!!session.map.network}
          ready={state.ready}
          onStart={() => runAndFocusRoad(() => session.start())}
        />
      )}
      {state.current && (
        <Incident key={state.current.id} state={state} session={session} act={runAndFocusRoad} />
      )}
      {state.journal && <Journal state={state} session={session} act={runAndFocusRoad} />}
    </>
  );
}
