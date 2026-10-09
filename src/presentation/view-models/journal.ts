import type { RuleType } from '../../domain/learning/question';
import type { History, Trip, Violation } from '../../domain/world/model';
import type { ReadonlyData } from '../../domain/world/read-only';

export const ruleLabels: Record<RuleType, string> = {
  stop: 'STOP',
  speed: 'Скорость',
  signal: 'Светофор',
  indicator: 'Поворотники',
  pedestrian: 'Пешеход',
};

export const tripStatusLabels: Record<Trip['status'], string> = {
  active: 'Поездка продолжается',
  interrupted: 'Прервана закрытием страницы',
  restarted: 'Начата заново',
  legacy: 'Перенесена из версии 0.1.0',
  finished: 'Завершена',
};

export interface JournalFilters {
  trip: string;
  rule: 'all' | RuleType;
  result: 'all' | 'unanswered' | 'wrong' | 'correct' | 'assisted' | 'skipped';
}

export interface JournalEntry {
  violation: ReadonlyData<Violation>;
  answerCount: number;
  hasWrongAnswer: boolean;
  hasCorrectAnswer: boolean;
  independentCorrectCount: number;
  assisted: boolean;
  skipped: boolean;
}

function matchesResult(entry: JournalEntry, result: JournalFilters['result']) {
  switch (result) {
    case 'unanswered':
      return entry.answerCount === 0;
    case 'wrong':
      return entry.hasWrongAnswer;
    case 'correct':
      return entry.hasCorrectAnswer;
    case 'assisted':
      return entry.assisted;
    case 'skipped':
      return entry.skipped;
    case 'all':
      return true;
  }
}

export function createJournalView(
  history: ReadonlyData<History>,
  filters: JournalFilters,
  completedTripId: string | null,
) {
  const revealedIds = new Set(history.revealed);

  const skippedIds = new Set(history.skips.map((skip) => skip.violationId));

  const entriesById = new Map<string, JournalEntry>();

  for (const violation of history.violations) {
    entriesById.set(violation.id, {
      violation,
      answerCount: 0,
      hasWrongAnswer: false,
      hasCorrectAnswer: false,
      independentCorrectCount: 0,
      assisted: revealedIds.has(violation.id),
      skipped: skippedIds.has(violation.id),
    });
  }

  for (const answer of history.answers) {
    const entry = entriesById.get(answer.violationId);

    if (!entry) {
      continue;
    }

    entry.answerCount++;
    entry.hasWrongAnswer ||= !answer.correct;
    entry.hasCorrectAnswer ||= answer.correct;
    entry.independentCorrectCount += Number(answer.correct && !answer.assisted);
  }

  const allEntries = [...entriesById.values()];

  const entries = allEntries
    .filter(
      (entry) =>
        (filters.trip === 'all' || entry.violation.tripId === filters.trip) &&
        (filters.rule === 'all' ||
          entry.violation.causes.some((cause) => cause.rule === filters.rule)) &&
        matchesResult(entry, filters.result),
    )
    .reverse();

  const completed = history.trips.find((trip) => trip.id === completedTripId);

  const completedEntries = completed
    ? allEntries.filter((entry) => entry.violation.tripId === completed.id)
    : [];

  const chosenTrip = history.trips.find((trip) => trip.id === filters.trip);

  return {
    entries,
    completed,
    completedSummary: {
      violations: completedEntries.length,
      answers: completedEntries.reduce((total, entry) => total + entry.answerCount, 0),
      independentCorrect: completedEntries.reduce(
        (total, entry) => total + entry.independentCorrectCount,
        0,
      ),
    },
    chosenTrip,
    isChosenTripClean:
      !!chosenTrip && !allEntries.some((entry) => entry.violation.tripId === chosenTrip.id),
  };
}
