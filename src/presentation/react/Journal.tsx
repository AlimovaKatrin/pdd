import { createJournalView, tripStatusLabels, type JournalFilters } from '../view-models/journal';
import { JournalFilterControls } from './JournalFilters';
import { JournalEntryButton } from './JournalEntry';
import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { GameSession, SessionSnapshot } from '../../use-cases/session/game-session';
import { Modal } from './Modal';

export function Journal({
  state,
  session,
  act,
}: {
  state: SessionSnapshot;
  session: GameSession;
  act: (fn: () => void) => void;
}) {
  const [filters, setFilters] = useState<JournalFilters>({
    trip: 'all',
    rule: 'all',
    result: 'all',
  });

  const [confirm, setConfirm] = useState(false);

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

  const { entries, completed, completedSummary, chosenTrip, isChosenTripClean } = createJournalView(
    history,
    filters,
    state.completedTripId,
  );

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
          Итог завершённой поездки: {completedSummary.violations} нарушений ·{' '}
          {completedSummary.answers} ответов · {completedSummary.independentCorrect} верных без
          помощи.
        </p>
      )}
      <p className="source-note">
        Всего: {history.trips.length} поездок · {history.violations.length} нарушений ·{' '}
        {history.answers.length} ответов
      </p>
      <JournalFilterControls
        filters={filters}
        trips={history.trips}
        onChange={(nextFilters) => {
          setFilters(nextFilters);
          resetScroll();
        }}
      />
      {chosenTrip && (
        <p className="source-note">
          {tripStatusLabels[chosenTrip.status]} · {entries.length} записей по фильтру
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
        {entries.map((entry) => (
          <JournalEntryButton
            key={entry.violation.id}
            entry={entry}
            buttonRef={(node) => {
              if (entry.violation.id === reviewedId.current) {
                reviewedButton.current = node;
              }
            }}
            onReview={() => {
              scrollTop.current = list.current?.scrollTop ?? 0;
              reviewedId.current = entry.violation.id;
              session.review(entry.violation.id);
            }}
          />
        ))}
        {!entries.length && (
          <p className="journal-empty">
            {isChosenTripClean ? 'Поездка без нарушений.' : 'Записей по выбранным условиям нет.'}
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
              setFilters({ ...filters, trip: 'all' });
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
