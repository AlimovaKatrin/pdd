import { ChevronDown } from 'lucide-react';
import type { Trip } from '../../domain/world/model';
import type { ReadonlyData } from '../../domain/world/read-only';
import { ruleLabels, type JournalFilters } from '../view-models/journal';

interface JournalFilterControlsProps {
  filters: JournalFilters;
  trips: ReadonlyData<Trip[]>;
  onChange: (filters: JournalFilters) => void;
}

export function JournalFilterControls({ filters, trips, onChange }: JournalFilterControlsProps) {
  return (
    <div className="journal-filters">
      <label>
        Поездка
        <span className="journal-select">
          <select
            aria-label="Поездка в журнале"
            value={filters.trip}
            onChange={(event) => onChange({ ...filters, trip: event.target.value })}
          >
            <option value="all">Все поездки</option>
            {[...trips].reverse().map((trip, index) => (
              <option key={trip.id} value={trip.id}>
                Поездка {trips.length - index} ·{' '}
                {new Date(trip.startedAt).toLocaleDateString('ru-RU')}
                {trip.status === 'active' ? ' · идёт' : ''}
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
            value={filters.rule}
            onChange={(event) =>
              onChange({ ...filters, rule: event.target.value as JournalFilters['rule'] })
            }
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
            value={filters.result}
            onChange={(event) =>
              onChange({ ...filters, result: event.target.value as JournalFilters['result'] })
            }
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
  );
}
