import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  ChevronDown,
  Flag,
  Leaf,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Route,
  Square,
  X,
} from 'lucide-react';
import type { GameSession } from '../../use-cases/session/game-session';
import { Incident } from './Incident';
import { CityGuide } from './CityGuide';
import { Journal } from './Journal';
import { activeSpeedZone } from '../../domain/world/traffic';
export function App({
  session,
  mountWorld,
}: {
  session: GameSession;
  mountWorld: (parent: HTMLElement) => () => void;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scene.current) {
      return mountWorld(scene.current);
    }
  }, [mountWorld]);
  const focusRoad = () => requestAnimationFrame(() => document.getElementById('road')?.focus());
  const act = (fn: () => void) => {
    fn();
    const next = session.getSnapshot();
    if (!next.journal && !next.current) {
      focusRoad();
    }
  };
  const speed = Math.round(Math.abs(state.world.vehicle.speed) * 3.6);
  const paused = state.started && state.pauses.length > 0;
  const showPause = paused && !state.current && !state.journal;
  const limit = activeSpeedZone(session.map, state.world.vehicle)?.limit;
  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="#road" aria-label="Тихий город — к игровому полю">
          <span className="brand-icon">
            <Route size={23} />
          </span>
          <span>
            тихий город<span className="brand-sub">УЧИМСЯ ЗА РУЛЁМ</span>
          </span>
        </a>
        <nav aria-label="Основная навигация">
          <button
            className={!state.journal ? 'nav-button active' : 'nav-button'}
            onClick={() => act(() => session.closeJournal())}
          >
            <Compass size={17} />
            Поездка
          </button>
          <button
            className={state.journal ? 'nav-button active' : 'nav-button'}
            onClick={() => session.openJournal()}
          >
            <BookOpen size={17} />
            Журнал
            {state.history.violations.length > 0 && (
              <span className="count">{state.history.violations.length}</span>
            )}
          </button>
        </nav>
        <span className="prototype">
          <span />
          MVP · предпросмотр
        </span>
      </header>
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
            <section
              className="map-card"
              id="road"
              role="application"
              tabIndex={0}
              aria-label="Игровое поле. Управление WASD или стрелками, пробел — тормоз."
            >
              <div className="map-label">
                <MapPin size={16} />
                <div>
                  <strong>Садовый квартал</strong>
                  <span>Небольшой город · без спешки</span>
                </div>
              </div>
              <div ref={scene} className="phaser-world" aria-hidden="true" />
              <div className="north">
                <span>N</span>
                <ArrowUpRight size={20} />
              </div>
              <span className="map-scale">
                <span />
                20 м
              </span>
            </section>
            <div className="dashboard" inert={!state.started} aria-hidden={!state.started}>
              <div className="speed">
                <strong data-testid="speed">{speed.toString().padStart(2, '0')}</strong>
                <span>км/ч</span>
              </div>
              <div className="indicator-controls">
                <button
                  aria-label="Левый поворотник"
                  aria-pressed={state.world.vehicle.indicator === 'left'}
                  className={state.world.vehicle.indicator === 'left' ? 'lit' : ''}
                  onClick={() => act(() => session.toggleIndicator('left'))}
                >
                  <ArrowLeft size={19} />
                  <kbd>Q</kbd>
                </button>
                <button
                  aria-label="Правый поворотник"
                  aria-pressed={state.world.vehicle.indicator === 'right'}
                  className={state.world.vehicle.indicator === 'right' ? 'lit' : ''}
                  onClick={() => act(() => session.toggleIndicator('right'))}
                >
                  <ArrowRight size={19} />
                  <kbd>E</kbd>
                </button>
              </div>
              <span className="speed-limit" aria-label="Ограничение скорости">
                {limit ?? '—'}
              </span>
              <span className="drive-state">
                <span className={paused ? 'dot amber' : 'dot'} />
                {paused ? 'Пауза' : state.world.vehicle.speed < 0 ? 'Задний ход' : 'В пути'}
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
          </div>
          <aside className="sidebar">
            <CityGuide />
            <details className="controls-card">
              <summary className="section-heading controls-toggle">
                <h3>Всё под рукой</h3>
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <div className="controls-content">
                <div className="control-row">
                  <span>
                    <kbd>W</kbd>
                    <kbd>↑</kbd>
                  </span>
                  <span>Разгон</span>
                </div>
                <div className="control-row">
                  <span>
                    <kbd>S</kbd>
                    <kbd>↓</kbd>
                  </span>
                  <span>Тормоз / задний ход</span>
                </div>
                <div className="control-row">
                  <span>
                    <kbd>A</kbd>
                    <kbd>D</kbd>
                    <span className="key-or">/</span>
                    <kbd>←</kbd>
                    <kbd>→</kbd>
                  </span>
                  <span>Поворот</span>
                </div>
                <div className="control-row">
                  <kbd className="space-key">Пробел</kbd>
                  <span>Полная остановка</span>
                </div>
                <div className="control-row">
                  <span>
                    <kbd>Q</kbd>
                    <kbd>E</kbd>
                  </span>
                  <span>Поворотники</span>
                </div>
                <div className="control-footer">
                  <kbd>Esc</kbd>
                  <span>Пауза</span>
                </div>
              </div>
            </details>
            <section className="progress-card">
              <div>
                <span className="progress-icon">
                  <Flag size={19} />
                </span>
                <h3>Опыт этой поездки</h3>
              </div>
              <div className="stat-row">
                <span>Правильных манёвров</span>
                <strong>{state.world.successfulManeuvers}</strong>
              </div>
              <div className="stat-row">
                <span>Ситуаций в журнале</span>
                <strong>
                  {state.history.violations.filter((v) => v.tripId === state.activeTripId).length}
                </strong>
              </div>
              <button className="text-button" onClick={() => session.openJournal()}>
                Открыть журнал <ArrowRight size={15} />
              </button>
            </section>
          </aside>
        </div>
        <footer className="footer">
          <span>
            <span className={`dot ${state.storage === 'error' ? 'amber' : ''}`} />
            {state.storage === 'error'
              ? 'История только в памяти'
              : state.storage === 'saving'
                ? 'Сохраняем…'
                : 'История хранится в этом браузере'}
          </span>
          <span>Учебный прототип · ПДД РФ, категория B</span>
        </footer>
        {state.world.advisories.length > 0 && (
          <p className="notice" role="status">
            {state.world.advisories[0]}
          </p>
        )}
        {state.notice && (
          <p className="notice" role="status">
            {state.notice}
          </p>
        )}
      </main>
      {showPause && (
        <div className="pause-card">
          <Pause size={25} />
          <h2>Небольшая остановка</h2>
          <p>Город подождёт. Продолжайте, когда будете готовы.</p>
          <button className="primary" onClick={() => act(() => session.resume())}>
            Продолжить поездку <Play size={16} />
          </button>
        </div>
      )}
      {!state.started && (
        <div className="welcome">
          <span className="welcome-icon">
            <Leaf size={23} />
          </span>
          <h2>Хорошее место для первой поездки</h2>
          <p>
            Впереди знак STOP. Попробуйте остановиться перед линией — или узнайте, что случится,
            если проехать.
          </p>
          <button
            className="primary"
            disabled={!state.ready}
            onClick={() => act(() => session.start())}
          >
            <Play size={17} />
            {state.ready ? 'Поехать в город' : 'Загружаем историю…'}
            <ArrowRight size={17} />
          </button>
          <span className="desktop-note">Для компьютера · управление с клавиатуры</span>
        </div>
      )}
      {state.current && (
        <Incident key={state.current.id} state={state} session={session} act={act} />
      )}
      {state.journal && <Journal state={state} session={session} act={act} />}
      <div className="mobile-banner">
        <X size={16} />
        Для управления нужен компьютер с клавиатурой.
      </div>
    </div>
  );
}
