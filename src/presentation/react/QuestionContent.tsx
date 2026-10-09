import { hasLongQuestion } from '../view-models/incident';
import type { ReadonlyData } from '../../domain/world/read-only';
import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Question } from '../../domain/learning/question';
import type { AnswerAttempt } from '../../domain/world/model';
import { Pager, PagedText } from './Pager';

export function QuestionContent({
  question,
  answer,
  revealed,
  onAnswer,
}: {
  question: ReadonlyData<Question>;
  answer: AnswerAttempt | null;
  revealed: boolean;
  onAnswer: (index: number) => void;
}) {
  const [view, setView] = useState<'question' | 'image' | 'options'>('question');

  const [option, setOption] = useState(0);

  const [imageError, setImageError] = useState(false);

  const extended = hasLongQuestion(question) || question.options.length > 4 || !!question.image;

  const optionClassName = (index: number) => {
    let answerClass = '';

    if (answer?.answer === index) {
      answerClass = answer.correct ? 'correct' : 'wrong';
    }

    const revealedClass = revealed && question.correctIndex === index ? 'correct' : '';

    return `${answerClass} ${revealedClass}`;
  };

  if (!extended) {
    return (
      <>
        <h3 className="question-title">{question.title}</h3>
        <div className="answers">
          {question.options.map((label, i) => (
            <button
              key={label}
              disabled={!!answer}
              className={`answer-option ${optionClassName(i)}`}
              onClick={() => onAnswer(i)}
            >
              <span>{revealed && question.correctIndex === i ? <Check size={15} /> : i + 1}</span>
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
        {question.image && (
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
          <PagedText key="title" text={question.title} limit={220} />
        </div>
      )}
      {view === 'image' &&
        question.image &&
        (imageError ? (
          <p>Иллюстрация этой версии недоступна. Можно продолжить без ответа.</p>
        ) : (
          <>
            <img
              className="question-image"
              src={question.image.src}
              alt={question.image.alt}
              onError={() => setImageError(true)}
            />
            <p className="source-note">{question.image.alt}</p>
          </>
        ))}
      {view === 'options' && (
        <>
          <Pager
            page={option}
            total={question.options.length}
            onChange={setOption}
            label="Вариант"
          />
          <p className="question-title">
            <PagedText key={option} text={question.options[option]} limit={220} />
          </p>
          <button
            disabled={!!answer}
            className={`answer-option ${optionClassName(option)}`}
            onClick={() => onAnswer(option)}
          >
            Выбрать вариант {option + 1}
            {revealed && question.correctIndex === option ? ' · верный' : ''}
          </button>
        </>
      )}
    </>
  );
}
