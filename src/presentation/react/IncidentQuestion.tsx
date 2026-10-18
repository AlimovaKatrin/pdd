import type { AnswerAttempt, Violation } from '../../domain/world/model';
import type { Question } from '../../domain/learning/question';
import type { ReadonlyData } from '../../domain/world/read-only';
import { QuestionContent } from './QuestionContent';
import { useState } from 'react';
import { PagedText } from './Pager';

interface IncidentQuestionProps {
  current: ReadonlyData<Violation>;
  question?: ReadonlyData<Question>;
  answer: ReadonlyData<AnswerAttempt> | null;
  revealed: boolean;
  onAnswer: (index: number) => void;
  onReveal: () => void;
}

export function IncidentQuestion({
  current,
  question,
  answer,
  revealed,
  onAnswer,
  onReveal,
}: IncidentQuestionProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <section className="incident-question" aria-label="Учебный вопрос">
      <div className="demo-label">
        {question?.status === 'verified'
          ? `Категория B · билет ${question.official?.ticket} · вопрос ${question.official?.number}`
          : 'Авторский учебный вопрос · не официальный билет'}
      </div>
      {question ? (
        <>
          {question.context === 'related' && <p className="source-note">{question.difference}</p>}
          <button
            className="text-button"
            onClick={() => {
              if (!showExplanation) {
                onReveal();
              }

              setShowExplanation(!showExplanation);
            }}
          >
            {showExplanation ? 'Вернуться к вопросу' : 'Объяснение вопроса'}
          </button>
          {showExplanation ? (
            <>
              <p>
                <PagedText text={question.explanation} limit={220} />
              </p>
              <a
                className="source-link"
                href={question.reference.url}
                target="_blank"
                rel="noreferrer"
              >
                {question.reference.label}
              </a>
              <p className="source-note">{question.reference.verification}</p>
            </>
          ) : (
            <QuestionContent
              question={question}
              answer={answer}
              revealed={revealed}
              onAnswer={onAnswer}
            />
          )}
          {answer && (
            <p role="status" className="answer-result">
              {answer.correct ? 'Верно.' : 'Попробуем разобраться.'}{' '}
              {answer.assisted ? 'Ответ с помощью.' : 'Самостоятельный ответ сохранён.'} Нарушение
              осталось в журнале.
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
  );
}
