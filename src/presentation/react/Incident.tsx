import { QuestionContent } from './QuestionContent';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronRight, RotateCcw } from 'lucide-react';
import type { GameSession, SessionSnapshot } from '../../use-cases/session/game-session';
import type { Cause } from '../../domain/world/model';
import { Modal } from './Modal';
import { Pager, PagedText } from './Pager';
function factText(c: Cause) {
  if (c.rule === 'speed') {
    return `Лимит: ${String(c.facts.limitKmh)} км/ч. Превышение: ${(Number(c.facts.speedKmh) - Number(c.facts.limitKmh)).toFixed(1)} км/ч.`;
  }
  if (c.rule === 'signal') {
    return `Сигнал при пересечении: ${c.facts.signal === 'red' ? 'красный' : 'красный с жёлтым'}.`;
  }
  if (c.rule === 'pedestrian') {
    return `Пешеход имел преимущество и был вынужден остановиться: ${String(c.facts.intendedSpeed)} → 0 м/с.`;
  }
  if (c.rule === 'indicator') {
    return `Поворот ${c.facts.direction === 'left' ? 'налево' : 'направо'}. Сигнал при начале: ${c.facts.initialIndicator === 'off' ? 'выключен' : c.facts.initialIndicator === 'left' ? 'левый' : 'правый'}.`;
  }
  return '';
}
export function Incident({
  state,
  session,
  act,
}: {
  state: SessionSnapshot;
  session: GameSession;
  act: (fn: () => void) => void;
}) {
  const [causePage, setCausePage] = useState(0),
    [attempts, setAttempts] = useState(false),
    [attemptPage, setAttemptPage] = useState(0);
  const [pane, setPane] = useState<'context' | 'question'>('context');
  const current = state.current!;
  const paged =
    current.type !== 'stop' ||
    current.causes.length > 1 ||
    !!state.question?.image ||
    (state.question?.title.length ?? 0) > 180 ||
    state.question?.options.some((o) => o.length > 130);
  const selectedCause = current.causes[Math.min(causePage, current.causes.length - 1)];
  const timeline = [
    ...state.history.answers
      .filter((a) => a.violationId === current.id)
      .map((a) => ({
        date: a.date,
        label: `Ответ ${a.answer + 1}: ${a.correct ? 'верно' : 'ошибка'} · ${a.assisted ? 'с помощью' : 'самостоятельно'}`,
      })),
    ...state.history.skips
      .filter((s) => s.violationId === current.id)
      .map((s) => ({ date: s.date, label: 'Пропуск: продолжение без ответа' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
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
      {state.question &&
        !current.causes.every(
          (c) => state.question!.matches?.includes(c.code) ?? c.code === 'stop-line',
        ) && (
          <p className="source-note">
            Сохранённый вопрос относится к первоначальной причине; новые причины разбираются
            отдельно.
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
              <p>{timeline[Math.min(attemptPage, timeline.length - 1)].label}</p>
              <p className="source-note">
                {timeline[Math.min(attemptPage, timeline.length - 1)].date}
              </p>
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
          <section className="incident-context" aria-label="Обстоятельства и объяснение">
            {current.causes.length > 1 && (
              <Pager
                page={causePage}
                total={current.causes.length}
                onChange={setCausePage}
                label="Причина"
              />
            )}
            {current.causes.length > 1 && (
              <strong className="cause-title">{selectedCause.title}</strong>
            )}
            <div className="evidence">
              <span>Скорость в момент события</span>
              <strong>{(current.speed * 3.6).toFixed(1)} км/ч</strong>
            </div>
            {state.question ? (
              <>
                {state.revealed ? (
                  <div className="explanation">
                    <strong>Почему так</strong>
                    <br />
                    <PagedText
                      text={
                        current.causes.length > 1
                          ? `${selectedCause.explanation} ${state.question.explanation}`
                          : state.question.explanation
                      }
                    />
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
              <>
                <p>
                  <PagedText text={selectedCause.explanation} />
                </p>
                <a
                  className="source-link"
                  href={selectedCause.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  ПДД РФ · {selectedCause.reference}
                </a>
                <p className="source-note">Объяснение авторское · КонсультантПлюс</p>
              </>
            )}
            {current.type !== 'stop' && <p className="source-note">{factText(selectedCause)}</p>}
          </section>
          <section className="incident-question" aria-label="Учебный вопрос">
            <div className="demo-label">
              {state.question?.status === 'verified'
                ? `Категория B · билет ${state.question.official?.ticket} · вопрос ${state.question.official?.number}`
                : 'Авторский учебный вопрос · не официальный билет'}
            </div>
            {state.question ? (
              <>
                {state.question.context === 'related' && (
                  <p className="source-note">{state.question.difference}</p>
                )}
                <QuestionContent
                  question={state.question}
                  answer={state.answer}
                  revealed={state.revealed}
                  onAnswer={(index) => session.answerQuestion(index)}
                />
                {state.answer && (
                  <p role="status" className="answer-result">
                    {state.answer.correct ? 'Верно.' : 'Попробуем разобраться.'}{' '}
                    {state.answer.assisted ? 'Ответ с помощью.' : 'Самостоятельный ответ сохранён.'}{' '}
                    Нарушение осталось в журнале.
                  </p>
                )}
              </>
            ) : (
              <p>
                {current.materialUnavailable ??
                  'Исторический материал недоступен. Можно продолжить поездку.'}
              </p>
            )}
          </section>
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
