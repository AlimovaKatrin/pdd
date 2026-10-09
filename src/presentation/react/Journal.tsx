import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Play } from 'lucide-react';
import type { GameSession, SessionSnapshot } from '../../use-cases/session/game-session';
import { Modal } from './Modal';
const ruleLabels = {
  stop: 'STOP',
  speed: 'Скорость',
  signal: 'Светофор',
  indicator: 'Поворотники',
  pedestrian: 'Пешеход',
};
export function Journal({
  state,
  session,
  act,
}: {
  state: SessionSnapshot;
  session: GameSession;
  act: (fn: () => void) => void;
}) {
  const [trip, setTrip] = useState('all'),
    [rule, setRule] = useState('all'),
    [result, setResult] = useState('all'),
    [confirm, setConfirm] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  const reviewedId = useRef<string | null>(null);
  const reviewedButton = useRef<HTMLButtonElement>(null);
  const current = state.current;
  useEffect(() => {
    if (current || !list.current) {
      return;
    }
    list.current.scrollTop = scrollTop.current;
  }, [current]);
  const resetScroll = () => {
    scrollTop.current = 0;
    reviewedId.current = null;
    reviewedButton.current = null;
    list.current?.scrollTo({ top: 0 });
  };
  const { history } = state;
  const entries = [...history.violations].reverse().filter((v) => {
    const answers = history.answers.filter((a) => a.violationId === v.id);
    return (
      (trip === 'all' || v.tripId === trip) &&
      (rule === 'all' || v.causes.some((c) => c.rule === rule)) &&
      (result === 'all' ||
        (result === 'unanswered' && !answers.length) ||
        (result === 'wrong' && answers.some((a) => !a.correct)) ||
        (result === 'correct' && answers.some((a) => a.correct)) ||
        (result === 'assisted' && history.revealed.includes(v.id)) ||
        (result === 'skipped' && history.skips.some((s) => s.violationId === v.id)))
    );
  });
  const completed = history.trips.find((t) => t.id === state.completedTripId);
  const completedViolations = completed
    ? history.violations.filter((v) => v.tripId === completed.id)
    : [];
  const completedAnswers = history.answers.filter((a) =>
    completedViolations.some((v) => v.id === a.violationId),
  );
  const chosenTrip = history.trips.find((t) => t.id === trip);
  if (state.current) {
    return null;
  }
  return (
    <Modal
      title="Журнал поездок"
      className="journal-modal"
      initialFocus={reviewedButton}
      wide
      onClose={() => act(() => session.closeJournal())}
    >
      <div className="modal-kicker">ВАШ ОПЫТ</div>
      <h2>Журнал поездок</h2>
      {completed && (
        <p className="trip-summary">
          Итог завершённой поездки: {completedViolations.length} нарушений ·{' '}
          {completedAnswers.length} ответов ·{' '}
          {completedAnswers.filter((a) => a.correct && !a.assisted).length} верных без помощи.
        </p>
      )}
      <p className="source-note">
        Всего: {history.trips.length} поездок · {history.violations.length} нарушений ·{' '}
        {history.answers.length} ответов
      </p>
      <div className="journal-filters">
        <label>
          Поездка
          <span className="journal-select">
            <select
              aria-label="Поездка в журнале"
              value={trip}
              onChange={(e) => {
                setTrip(e.target.value);
                resetScroll();
              }}
            >
              <option value="all">Все поездки</option>
              {[...history.trips].reverse().map((t, i) => (
                <option key={t.id} value={t.id}>
                  Поездка {history.trips.length - i} ·{' '}
                  {new Date(t.startedAt).toLocaleDateString('ru-RU')}
                  {t.status === 'active' ? ' · идёт' : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </label>
        <label>
          Правило
          <span className="journal-select">
            <select
              aria-label="Вид нарушения"
              value={rule}
              onChange={(e) => {
                setRule(e.target.value);
                resetScroll();
              }}
            >
              <option value="all">Все правила</option>
              {Object.entries(ruleLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </label>
        <label>
          Результат
          <span className="journal-select">
            <select
              aria-label="Результат ответа"
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                resetScroll();
              }}
            >
              <option value="all">Все результаты</option>
              <option value="wrong">Были ошибки</option>
              <option value="unanswered">Без ответа</option>
              <option value="correct">Был верный ответ</option>
              <option value="assisted">С разбором</option>
              <option value="skipped">Был пропуск</option>
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </label>
      </div>
      {chosenTrip && (
        <p className="source-note">
          {chosenTrip.status === 'active'
            ? 'Поездка продолжается'
            : chosenTrip.status === 'interrupted'
              ? 'Прервана закрытием страницы'
              : chosenTrip.status === 'restarted'
                ? 'Начата заново'
                : chosenTrip.status === 'legacy'
                  ? 'Перенесена из версии 0.1.0'
                  : 'Завершена'}{' '}
          · {entries.length} записей по фильтру
        </p>
      )}
      <div
        className="journal-list"
        ref={list}
        role="region"
        aria-label="Записи журнала"
        onScroll={(event) => {
          scrollTop.current = event.currentTarget.scrollTop;
        }}
      >
        {entries.map((v) => (
          <button
            key={v.id}
            data-entry-id={v.id}
            ref={(node) => {
              if (v.id === reviewedId.current) {
                reviewedButton.current = node;
              }
            }}
            onClick={() => {
              scrollTop.current = list.current?.scrollTop ?? 0;
              reviewedId.current = v.id;
              session.review(v.id);
            }}
          >
            <span className="incident-symbol">{ruleLabels[v.type]}</span>
            <span>
              <strong>
                {v.causes[0].title}
                {v.causes.length > 1 ? ` +${v.causes.length - 1}` : ''}
              </strong>
              <small>
                {new Date(v.date).toLocaleString('ru-RU')} ·{' '}
                {history.answers.filter((a) => a.violationId === v.id).length} ответ(а)
                {history.skips.some((s) => s.violationId === v.id) ? ' · был пропуск' : ''}
              </small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
        {!entries.length && (
          <p className="journal-empty">
            {chosenTrip && !history.violations.some((v) => v.tripId === chosenTrip.id)
              ? 'Поездка без нарушений.'
              : 'Записей по выбранным условиям нет.'}
          </p>
        )}
      </div>
      {confirm ? (
        <div className="confirm-clear">
          <p>Удалить поездки, нарушения и ответы?</p>
          <button className="secondary" onClick={() => setConfirm(false)}>
            Отмена
          </button>
          <button
            className="secondary danger"
            onClick={() => {
              session.clearHistory();
              setTrip('all');
              resetScroll();
              setConfirm(false);
            }}
          >
            Да, удалить
          </button>
        </div>
      ) : (
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
          {(history.trips.length > 0 || state.storage === 'error') && (
            <button className="text-button danger" onClick={() => setConfirm(true)}>
              Очистить историю
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
