import { ArrowUpRight, ChevronRight } from 'lucide-react';
import type { Cause, Violation } from '../../domain/world/model';
import type { Question } from '../../domain/learning/question';
import type { ReadonlyData } from '../../domain/world/read-only';
import { formatCauseFacts } from '../view-models/incident';
import { Pager, PagedText } from './Pager';

interface IncidentContextProps {
  current: ReadonlyData<Violation>;
  selectedCause: ReadonlyData<Cause>;
  question?: ReadonlyData<Question>;
  revealed: boolean;
  causePage: number;
  onCausePageChange: (page: number) => void;
  onReveal: () => void;
}

export function IncidentContext({
  current,
  selectedCause,
  question,
  revealed,
  causePage,
  onCausePageChange,
  onReveal,
}: IncidentContextProps) {
  return (
    <section className="incident-context" aria-label="Обстоятельства и объяснение">
      {current.causes.length > 1 && (
        <Pager
          page={causePage}
          total={current.causes.length}
          onChange={onCausePageChange}
          label="Причина"
        />
      )}
      {current.causes.length > 1 && <strong className="cause-title">{selectedCause.title}</strong>}
      <div className="evidence">
        <span>Скорость в момент события</span>
        <strong>{(current.speed * 3.6).toFixed(1)} км/ч</strong>
      </div>
      {question ? (
        <>
          {revealed ? (
            <div className="explanation">
              <strong>Почему так</strong>
              <br />
              <PagedText key={selectedCause.code} text={selectedCause.explanation} />
            </div>
          ) : (
            <button className="text-button reveal-answer" onClick={onReveal}>
              Показать разбор <ChevronRight size={15} />
            </button>
          )}
        </>
      ) : (
        <>
          <p>
            <PagedText key={selectedCause.code} text={selectedCause.explanation} />
          </p>
        </>
      )}
      <a
        className="source-link"
        href={selectedCause.referenceUrl}
        target="_blank"
        rel="noreferrer"
        onClick={onReveal}
      >
        ПДД РФ · {selectedCause.reference}
        <ArrowUpRight size={14} />
      </a>
      {selectedCause.additionalReferences?.map((reference) => (
        <a
          key={reference.url}
          className="source-link"
          href={reference.url}
          target="_blank"
          rel="noreferrer"
          onClick={onReveal}
        >
          ПДД РФ · {reference.label}
          <ArrowUpRight size={14} />
        </a>
      ))}
      <p className="source-note">
        Объяснение авторское · КонсультантПлюс · Постановление № 1090 ·{' '}
        {selectedCause.referenceCheckedOn
          ? `Проверено: ${selectedCause.referenceCheckedOn}`
          : 'Дата проверки в архивной записи не указана'}
      </p>
      {selectedCause.rule !== 'stop' && (
        <p className="source-note">{formatCauseFacts(selectedCause)}</p>
      )}
    </section>
  );
}
