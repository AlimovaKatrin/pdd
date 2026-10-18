import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Square } from 'lucide-react';
import type { GameSession, SessionSnapshot } from '../../use-cases/session/game-session';

export function Dashboard({
  state,
  session,
  act,
}: {
  state: SessionSnapshot;
  session: GameSession;
  act: (action: () => void) => void;
}) {
  const { driving } = state;

  const speed = driving.speedKmh;

  const paused = state.started && state.pauses.length > 0;

  const limit = driving.speedLimit;

  const drivingStatus = paused ? 'Пауза' : driving.reversing ? 'Задний ход' : 'В пути';

  return (
    <div className="dashboard" inert={!state.started} aria-hidden={!state.started}>
      <div className="speed">
        <strong data-testid="speed">{speed.toString().padStart(2, '0')}</strong>
        <span>км/ч</span>
      </div>
      <div className="indicator-controls">
        <button
          aria-label="Левый поворотник"
          aria-pressed={driving.indicator === 'left'}
          className={driving.indicator === 'left' ? 'lit' : ''}
          onClick={() => act(() => session.toggleIndicator('left'))}
        >
          <ArrowLeft size={19} />
          <kbd>Q</kbd>
        </button>
        <button
          aria-label="Правый поворотник"
          aria-pressed={driving.indicator === 'right'}
          className={driving.indicator === 'right' ? 'lit' : ''}
          onClick={() => act(() => session.toggleIndicator('right'))}
        >
          <ArrowRight size={19} />
          <kbd>E</kbd>
        </button>
      </div>
      <span className="speed-limit" aria-label="Ограничение скорости">
        {limit}
      </span>
      <span className="drive-state">
        <span className={paused ? 'dot amber' : 'dot'} />
        {drivingStatus}
      </span>
      <div className="trip-controls" role="group" aria-label="Управление поездкой">
        <button
          className="icon-button"
          aria-label={paused ? 'Возобновить' : 'Пауза'}
          title={paused ? 'Возобновить' : 'Пауза'}
          onClick={() => act(() => (paused ? session.resume() : session.pause('manual')))}
        >
          {paused ? <Play size={19} /> : <Pause size={19} />}
        </button>
        <button
          className="icon-button"
          aria-label="Начать поездку заново"
          title="Начать поездку заново"
          onClick={() => act(() => session.start())}
        >
          <RotateCcw size={19} />
        </button>
        <button
          className="icon-button"
          aria-label="Завершить поездку"
          title="Завершить поездку"
          onClick={() => session.finish()}
        >
          <Square size={19} />
        </button>
      </div>
    </div>
  );
}
