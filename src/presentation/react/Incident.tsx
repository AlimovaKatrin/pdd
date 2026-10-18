import { questionCoversCauses } from '../../domain/learning/question';
import { incidentTimeline, usesPagedIncident } from '../view-models/incident';
import { IncidentContext } from './IncidentContext';
import { IncidentQuestion } from './IncidentQuestion';
import { useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import type { GameSession, SessionSnapshot } from '../../use-cases/session/game-session';
import { Modal } from './Modal';
import { Pager } from './Pager';

export function Incident({
  state,
  session,
  act,
}: {
  state: SessionSnapshot;
  session: GameSession;
  act: (fn: () => void) => void;
}) {
  const [causePage, setCausePage] = useState(0);

  const [attempts, setAttempts] = useState(false);

  const [attemptPage, setAttemptPage] = useState(0);

  const [pane, setPane] = useState<'context' | 'question'>('context');

  if (!state.current) {
    return null;
  }

  const current = state.current;

  const paged = usesPagedIncident(current, state.question);

  const selectedCause = current.causes[Math.min(causePage, current.causes.length - 1)];

  const timeline = incidentTimeline(state.history, current.id);

  const selectedAttempt = timeline[Math.min(attemptPage, timeline.length - 1)];

  const questionCoversIncident =
    !state.question ||
    questionCoversCauses(
      state.question,
      current.causes.map((cause) => cause.code),
    );

  return (
    <Modal
      className="incident-modal"
      title="Разбор нарушения"
      onClose={() => act(() => session.continueTrip())}
    >
      <header className="incident-header">
        <div className="modal-kicker">
          <span className="incident-symbol">{current.type === 'stop' ? 'STOP' : 'ПДД'}</span>
          РАЗБЕРЁМСЯ ВМЕСТЕ
        </div>
        <h2>{current.type === 'stop' ? 'Здесь нужна остановка' : selectedCause.title}</h2>
        <p className="modal-lead">
          {current.type === 'stop'
            ? 'Машина пересекла стоп-линию без полной остановки перед ней.'
            : 'Событие сохранено. Разберитесь и продолжайте поездку.'}
        </p>
      </header>
      {!questionCoversIncident && (
        <p className="source-note">
          Сохранённый вопрос относится к первоначальной причине; новые причины разбираются отдельно.
        </p>
      )}
      <div className="review-tabs">
        <button className="text-button" onClick={() => setAttempts(false)}>
          Разбор
        </button>
        <button className="text-button" onClick={() => setAttempts(true)}>
          Попытки ({timeline.length})
        </button>
      </div>
      {paged && !attempts && (
        <div className="compact-review-tabs">
          <button
            className="text-button"
            aria-pressed={pane === 'context'}
            onClick={() => setPane('context')}
          >
            Обстоятельства
          </button>
          <button
            className="text-button"
            aria-pressed={pane === 'question'}
            onClick={() => setPane('question')}
          >
            Вопрос
          </button>
        </div>
      )}
      {attempts ? (
        <div className="attempt-timeline">
          {timeline.length ? (
            <>
              <p>{selectedAttempt.label}</p>
              <p className="source-note">{selectedAttempt.date}</p>
              <Pager
                page={attemptPage}
                total={timeline.length}
                onChange={setAttemptPage}
                label="Попытка"
              />
            </>
          ) : (
            <p>Ответов и пропусков пока нет.</p>
          )}
        </div>
      ) : (
        <div className={`incident-grid ${paged ? `paged-incident pane-${pane}` : ''}`}>
          <IncidentContext
            current={current}
            selectedCause={selectedCause}
            question={state.question}
            revealed={state.revealed}
            causePage={causePage}
            onCausePageChange={setCausePage}
            onReveal={() => session.reveal()}
          />
          <IncidentQuestion
            current={current}
            question={state.question}
            answer={state.answer}
            revealed={state.revealed}
            onAnswer={(index) => session.answerQuestion(index)}
            onReveal={() => session.reveal()}
          />
        </div>
      )}
      <div className="modal-actions">
        {state.started && (
          <button
            className="secondary"
            onClick={() =>
              act(() => (session.canRetry(current.id) ? session.retry() : session.returnToRoad()))
            }
          >
            <RotateCcw size={16} />
            {session.canRetry(current.id) ? 'Повторить ситуацию' : 'На начало улицы'}
          </button>
        )}
        <button className="primary" onClick={() => act(() => session.continueTrip())}>
          {state.journal ? 'Назад в журнал' : 'Продолжить'} <ArrowRight size={16} />
        </button>
      </div>
      {!session.canRetry(current.id) && (
        <p className="source-note">
          Точное состояние этой ситуации недоступно. Возврат начнёт поездку с безопасного места.
        </p>
      )}
    </Modal>
  );
}
