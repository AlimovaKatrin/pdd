import type { Cause, History, Violation } from '../../domain/world/model';
import type { Question } from '../../domain/learning/question';
import type { ReadonlyData } from '../../domain/world/read-only';

const MAX_COMPACT_TITLE_LENGTH = 180;

const MAX_COMPACT_OPTION_LENGTH = 130;

export function hasLongQuestion(question: ReadonlyData<Question>) {
  return (
    question.title.length > MAX_COMPACT_TITLE_LENGTH ||
    question.options.some((option) => option.length > MAX_COMPACT_OPTION_LENGTH)
  );
}

export function usesPagedIncident(
  incident: ReadonlyData<Violation>,
  question?: ReadonlyData<Question>,
) {
  return (
    incident.type !== 'stop' ||
    incident.causes.length > 1 ||
    (!!question && (!!question.image || hasLongQuestion(question)))
  );
}

export function incidentTimeline(history: ReadonlyData<History>, violationId: string) {
  const answers = history.answers
    .filter((answer) => answer.violationId === violationId)
    .map((answer) => ({
      date: answer.date,
      label: `Ответ ${answer.answer + 1}: ${answer.correct ? 'верно' : 'ошибка'} · ${answer.assisted ? 'с помощью' : 'самостоятельно'}`,
    }));

  const skips = history.skips
    .filter((skip) => skip.violationId === violationId)
    .map((skip) => ({ date: skip.date, label: 'Пропуск: продолжение без ответа' }));

  return [...answers, ...skips].sort((first, second) => first.date.localeCompare(second.date));
}

export function formatCauseFacts(cause: ReadonlyData<Cause>) {
  const { facts } = cause;

  switch (cause.rule) {
    case 'speed':
      return `Лимит: ${String(facts.limitKmh)} км/ч. Превышение: ${(Number(facts.speedKmh) - Number(facts.limitKmh)).toFixed(1)} км/ч.`;
    case 'signal':
      return `Сигнал при пересечении: ${facts.signal === 'red' ? 'красный' : 'красный с жёлтым'}.`;
    case 'pedestrian':
      return `Пешеход имел преимущество и был вынужден остановиться: ${String(facts.intendedSpeed)} → 0 м/с.`;

    case 'indicator': {
      const direction = facts.direction === 'left' ? 'налево' : 'направо';

      let indicator = 'правый';

      if (facts.initialIndicator === 'off') {
        indicator = 'выключен';
      } else if (facts.initialIndicator === 'left') {
        indicator = 'левый';
      }

      return `Поворот ${direction}. Сигнал при начале: ${indicator}.`;
    }

    default:
      return '';
  }
}
