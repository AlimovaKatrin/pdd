import type { AnswerAttempt, Violation } from '../../domain/world/model';
import type { Question } from '../../domain/learning/question';
import type { ReadonlyData } from '../../domain/world/read-only';
import { QuestionContent } from './QuestionContent';

interface IncidentQuestionProps {
  current: ReadonlyData<Violation>;
  question?: ReadonlyData<Question>;
  answer: ReadonlyData<AnswerAttempt> | null;
  revealed: boolean;
  onAnswer: (index: number) => void;
}

export function IncidentQuestion({
  current,
  question,
  answer,
  revealed,
  onAnswer,
}: IncidentQuestionProps) {
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
          <QuestionContent
            question={question}
            answer={answer}
            revealed={revealed}
            onAnswer={onAnswer}
          />
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
