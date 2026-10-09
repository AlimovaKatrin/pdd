import { ChevronRight } from 'lucide-react';
import { ruleLabels, type JournalEntry } from '../view-models/journal';

interface JournalEntryButtonProps {
  entry: JournalEntry;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onReview: () => void;
}

export function JournalEntryButton({ entry, buttonRef, onReview }: JournalEntryButtonProps) {
  const { violation } = entry;

  return (
    <button data-entry-id={violation.id} ref={buttonRef} onClick={onReview}>
      <span className="incident-symbol">{ruleLabels[violation.type]}</span>
      <span>
        <strong>
          {violation.causes[0].title}
          {violation.causes.length > 1 ? ` +${violation.causes.length - 1}` : ''}
        </strong>
        <small>
          {new Date(violation.date).toLocaleString('ru-RU')} · {entry.answerCount} ответ(а)
          {entry.skipped ? ' · был пропуск' : ''}
        </small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
