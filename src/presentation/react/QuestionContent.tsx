import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Question } from '../../domain/learning/question';
import type { AnswerAttempt } from '../../domain/world/model';
import { Pager, PagedText } from './Pager';
export function QuestionContent({
  question: q,
  answer,
  revealed,
  onAnswer,
}: {
  question: Question;
  answer: AnswerAttempt | null;
  revealed: boolean;
  onAnswer: (index: number) => void;
}) {
  const [view, setView] = useState<'question' | 'image' | 'options'>('question'),
    [option, setOption] = useState(0),
    [imageError, setImageError] = useState(false);
  const extended =
    q.title.length > 180 ||
    q.options.some((o) => o.length > 130) ||
    q.options.length > 4 ||
    !!q.image;
  const stateClass = (i: number) =>
    `${answer?.answer === i ? (answer.correct ? 'correct' : 'wrong') : ''} ${revealed && q.correctIndex === i ? 'correct' : ''}`;
  if (!extended) {
    return (
      <>
        <h3 className="question-title">{q.title}</h3>
        <div className="answers">
          {q.options.map((label, i) => (
            <button
              key={label}
              disabled={!!answer}
              className={`answer-option ${stateClass(i)}`}
              onClick={() => onAnswer(i)}
            >
              <span>{revealed && q.correctIndex === i ? <Check size={15} /> : i + 1}</span>
              {label}
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="review-tabs">
        <button className="text-button" onClick={() => setView('question')}>
          Условие
        </button>
        {q.image && (
          <button className="text-button" onClick={() => setView('image')}>
            Иллюстрация
          </button>
        )}
        <button className="text-button" onClick={() => setView('options')}>
          Варианты ответа
        </button>
      </div>
      {view === 'question' && (
        <div className="question-title">
          <PagedText key="title" text={q.title} limit={220} />
        </div>
      )}
      {view === 'image' &&
        q.image &&
        (imageError ? (
          <p>Иллюстрация этой версии недоступна. Можно продолжить без ответа.</p>
        ) : (
          <>
            <img
              className="question-image"
              src={q.image.src}
              alt={q.image.alt}
              onError={() => setImageError(true)}
            />
            <p className="source-note">{q.image.alt}</p>
          </>
        ))}
      {view === 'options' && (
        <>
          <Pager page={option} total={q.options.length} onChange={setOption} label="Вариант" />
          <p className="question-title">
            <PagedText key={option} text={q.options[option]} limit={220} />
          </p>
          <button
            disabled={!!answer}
            className={`answer-option ${stateClass(option)}`}
            onClick={() => onAnswer(option)}
          >
            Выбрать вариант {option + 1}
            {revealed && q.correctIndex === option ? ' · верный' : ''}
          </button>
        </>
      )}
    </>
  );
}
