import { emptyHistory, type History } from '../../src/domain/world/model';
import { cause } from '../../src/domain/violations/causes';

export const cityJournalCauses = [
  'priority-left-green',
  'priority-main',
  'priority-right',
  'priority-left-equal',
  'priority-clearing',
  'oncoming-lane',
  'pedestrian-turn',
  'pedestrian-clearing',
] as const;

export function cityJournal(count: number = cityJournalCauses.length): History {
  const history = emptyHistory();

  history.trips = [
    {
      id: 'trip',
      startedAt: '2026-10-18T10:00:00Z',
      finishedAt: '2026-10-18T11:00:00Z',
      status: 'finished',
    },
  ];
  history.violations = Array.from({ length: count }, (_, index) => {
    const code = cityJournalCauses[index % cityJournalCauses.length];

    const reason = cause(code, {
      participantId: 'other-participant',
      participantLabel: code.startsWith('pedestrian') ? 'П1' : 'М7',
      playerFrom: 'south',
      participantFrom: 'north',
      playerMovement: 'left',
      participantMovement: 'straight',
      playerSignal: 'green',
      participantSignal: 'green',
      control: code === 'priority-main' ? 'priority' : 'signals',
      playerPriority: 'secondary',
      participantPriority: 'main',
      actualSpeedKmh: 5,
      unimpededSpeedKmh: 8,
      reaction: 'player-obstruction',
      participantWasClearing: code === 'priority-clearing',
      intendedSpeed: 1.2,
      actualSpeed: 0,
      marking: 'double-solid',
    });

    return {
      id: `city-event-${index}`,
      tripId: 'trip',
      attemptId: 'attempt',
      date: '2026-10-18T10:10:00Z',
      type: reason.rule,
      speed: 4,
      tick: 600,
      episode: index + 1,
      roadObjectId: 'archived-road',
      mapVersion: 'archived-map',
      rulesVersion: 'city-preview-1',
      causes: [reason],
      material: null,
    };
  });

  return history;
}
