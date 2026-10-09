import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  ChevronDown,
  Flag,
  History,
  Leaf,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Route,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react';
import type { GameSession } from '../../use-cases/session/game-session';
import { Modal } from './Modal';
export function App({
  session,
  mountWorld,
}: {
  session: GameSession;
  mountWorld: (parent: HTMLElement) => () => void;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const scene = useRef<HTMLDivElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (scene.current) {
      return mountWorld(scene.current);
    }
  }, [mountWorld]);
  const focusRoad = () => requestAnimationFrame(() => document.getElementById('road')?.focus());
  const act = (fn: () => void) => {
    fn();
    focusRoad();
  };
  const speed = Math.round(Math.abs(state.world.vehicle.speed) * 3.6);
  const paused = state.started && state.pauses.length > 0;
  const showPause = paused && !state.current && !state.journal;
  const independent = state.history.answers.filter((a) => a.correct && !a.assisted).length;
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
          Первый прототип
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
            <section className="lesson-card">
              <div className="eyebrow">
                <span className="small-line" />
                ЗНАКОМИМСЯ С ГОРОДОМ
              </div>
              <div className="lesson-heading">
                <h2>
                  Свобода ехать.
                  <br />
                  Возможность понять.
                </h2>
                <span className="stop-sign">STOP</span>
              </div>
              <p>
                Здесь нет таймера и оценки. Каждая ошибка — повод разобраться и попробовать ещё раз.
              </p>
              <div className="lesson-divider" />
              <div className="current-lesson">
                <span className="lesson-index">01</span>
                <div>
                  <strong>Остановка перед STOP</strong>
                  <span>Первый дорожный сценарий</span>
                </div>
              </div>
              <p className="lesson-hint">
                Полностью остановитесь перед белой линией. Затем продолжайте поездку.
              </p>
              <span className="scope-pill">
                <ShieldCheck size={14} />
                Сейчас проверяем только STOP
              </span>
            </section>
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
                <span>Правильных остановок</span>
                <strong>{state.world.successfulStops}</strong>
              </div>
              <div className="stat-row">
                <span>Ситуаций в журнале</span>
                <strong>{state.history.violations.length}</strong>
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
        {state.notice && (
          <p className="notice" role="status">
            {state.notice}
          </p>
        )}
      </main>
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
      {state.current ? (
        <Modal
          key="incident"
          className="incident-modal"
          title="Разбор нарушения"
          onClose={() => act(() => session.continueTrip())}
        >
          <header className="incident-header">
            <div className="modal-kicker">
              <span className="stop-sign small">STOP</span>РАЗБЕРЁМСЯ ВМЕСТЕ
            </div>
            <h2>Здесь нужна остановка</h2>
            <p className="modal-lead">
              Машина пересекла стоп-линию без полной остановки перед ней.
            </p>
          </header>
          <div className="incident-grid">
            <section className="incident-context" aria-label="Обстоятельства и объяснение">
              <div className="evidence">
                <span>Скорость при пересечении</span>
                <strong>{(state.current.speed * 3.6).toFixed(1)} км/ч</strong>
              </div>
              {state.question ? (
                <>
                  {state.revealed ? (
                    <div className="explanation">
                      <strong>Почему так</strong>
                      <p>{state.question.explanation}</p>
                    </div>
                  ) : (
                    <button className="text-button reveal-answer" onClick={() => session.reveal()}>
                      Показать разбор <ChevronRight size={15} />
                    </button>
                  )}
                  <a
                    className="source-link"
                    href={state.question.reference.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => session.reveal()}
                  >
                    {state.question.reference.label}
                    <ArrowUpRight size={14} />
                  </a>
                  <p className="source-note">{state.question.reference.verification}</p>
                </>
              ) : (
                <p>Необходимо полностью остановиться перед стоп-линией.</p>
              )}
            </section>
            <section className="incident-question" aria-label="Учебный вопрос">
              <div className="demo-label">Авторский учебный вопрос · не официальный билет</div>
              {state.question ? (
                <>
                  <h3 className="question-title">{state.question.title}</h3>
                  <div className="answers">
                    {state.question.options.map((option, i) => (
                      <button
                        key={option}
                        disabled={!!state.answer}
                        className={`answer-option ${state.answer?.answer === i ? (state.answer.correct ? 'correct' : 'wrong') : ''} ${state.revealed && state.question?.correctIndex === i ? 'correct' : ''}`}
                        onClick={() => session.answerQuestion(i)}
                      >
                        <span>
                          {state.revealed && state.question?.correctIndex === i ? (
                            <Check size={15} />
                          ) : (
                            i + 1
                          )}
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
                  {state.answer && (
                    <p role="status" className="answer-result">
                      {state.answer.correct ? 'Верно.' : 'Попробуем разобраться.'}{' '}
                      {state.answer.assisted
                        ? 'Ответ с помощью.'
                        : 'Самостоятельный ответ сохранён.'}{' '}
                      Нарушение осталось в журнале.
                    </p>
                  )}
                </>
              ) : (
                <p>Подходящий вопрос пока не добавлен. Можно продолжить поездку.</p>
              )}
            </section>
          </div>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() =>
                act(() =>
                  session.canRetry(state.current!.id) ? session.retry() : session.returnToRoad(),
                )
              }
            >
              <RotateCcw size={16} />
              {session.canRetry(state.current.id) ? 'Повторить ситуацию' : 'На начало улицы'}
            </button>
            <button className="primary" onClick={() => act(() => session.continueTrip())}>
              Продолжить <ArrowRight size={16} />
            </button>
          </div>
          {!session.canRetry(state.current.id) && (
            <p className="source-note">
              Точное состояние этой ситуации недоступно. Возврат начнёт поездку с безопасного места.
            </p>
          )}
        </Modal>
      ) : state.journal ? (
        <Modal
          key="journal"
          title="Журнал поездок"
          wide
          onClose={() => act(() => session.closeJournal())}
        >
          <div className="modal-kicker">
            <History size={18} />
            ВАШ ОПЫТ
          </div>
          <h2>Журнал поездок</h2>
          <p className="modal-lead">Ошибки остаются здесь, чтобы к ним можно было вернуться.</p>
          <div className="journal-stats">
            <div>
              <strong>{state.history.violations.length}</strong>
              <span>нарушений</span>
            </div>
            <div>
              <strong>{state.history.answers.length}</strong>
              <span>ответов</span>
            </div>
            <div>
              <strong>{independent}</strong>
              <span>верных без помощи</span>
            </div>
          </div>
          {!state.history.violations.length ? (
            <div className="empty-state">
              <BookOpen size={34} />
              <h3>Пока чистый лист</h3>
              <p>После первой дорожной ситуации здесь появится её разбор.</p>
            </div>
          ) : (
            <div className="journal-list">
              {[...state.history.violations].reverse().map((v) => {
                const attempts = state.history.answers.filter((a) => a.violationId === v.id);
                return (
                  <button key={v.id} onClick={() => session.review(v.id)}>
                    <span className="stop-sign small">STOP</span>
                    <span>
                      <strong>Проезд без остановки</strong>
                      <small>
                        {new Date(v.date).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {attempts.length ? `${attempts.length} ответ(а)` : 'Без ответа'}
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() =>
                act(() => {
                  session.closeJournal();
                  if (!state.started) {
                    session.start();
                  }
                })
              }
            >
              <Play size={16} />К поездке
            </button>
            {state.history.violations.length > 0 && (
              <button className="text-button danger" onClick={() => setConfirmClear(true)}>
                Очистить историю
              </button>
            )}
          </div>
          {confirmClear && (
            <div className="confirm-clear">
              <p>Удалить нарушения и ответы из этого браузера?</p>
              <button className="secondary" onClick={() => setConfirmClear(false)}>
                Отмена
              </button>
              <button
                className="secondary danger"
                onClick={() => {
                  session.clearHistory();
                  setConfirmClear(false);
                }}
              >
                Да, удалить
              </button>
            </div>
          )}
        </Modal>
      ) : null}
      <div className="mobile-banner">
        <X size={16} />
        Для управления нужен компьютер с клавиатурой.
      </div>
    </div>
  );
}
