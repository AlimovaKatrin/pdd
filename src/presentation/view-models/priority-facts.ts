import type { Cause } from '../../domain/world/model';
import type { ReadonlyData } from '../../domain/world/read-only';

const approaches: Record<string, string> = {
  north: 'с севера',
  south: 'с юга',
  east: 'с востока',
  west: 'с запада',
};

const movements: Record<string, string> = { left: 'налево', right: 'направо', straight: 'прямо' };

const signals: Record<string, string> = {
  green: 'зелёный',
  yellow: 'жёлтый',
  red: 'красный',
  'red-yellow': 'красный с жёлтым',
};

/** Historic unknown facts remain unknown; a missing value is not reconstructed from today's map. */
export function formatPriorityFacts(facts: ReadonlyData<Cause['facts']>): string {
  const playerFrom = approaches[String(facts.playerFrom)] ?? 'направление не сохранено';

  const otherFrom = approaches[String(facts.participantFrom)] ?? 'направление не сохранено';

  const playerMovement = movements[String(facts.playerMovement)] ?? 'манёвр не сохранён';

  const otherMovement = movements[String(facts.participantMovement)] ?? 'манёвр не сохранён';

  const label =
    typeof facts.participantLabel === 'string' ? facts.participantLabel : 'Другая машина';

  const details = [
    `Вы: ${playerFrom}, ${playerMovement}. ${label}: ${otherFrom}, ${otherMovement}.`,
  ];

  if (facts.control === 'signals') {
    details.push(
      `Сигнал на въезде: у вас ${signals[String(facts.playerSignal)] ?? 'не сохранён'}, у ${label} ${signals[String(facts.participantSignal)] ?? 'не сохранён'}.`,
    );
  }

  if (facts.control === 'priority') {
    const roads: Record<string, string> = { main: 'главная', secondary: 'второстепенная' };

    details.push(
      `Ваша дорога — ${roads[String(facts.playerPriority)] ?? 'приоритет не сохранён'}, дорога ${label} — ${roads[String(facts.participantPriority)] ?? 'приоритет не сохранён'}.`,
    );
  }

  if (facts.participantWasClearing === true) {
    details.push(`${label} уже завершала проезд, когда для вашего подхода включился зелёный.`);
  }

  if (
    facts.reaction === 'player-obstruction' &&
    typeof facts.actualSpeedKmh === 'number' &&
    typeof facts.unimpededSpeedKmh === 'number'
  ) {
    details.push(
      `${label} пришлось замедлиться или подождать из-за вашей машины. Скорость ${facts.actualSpeedKmh.toFixed(1)} км/ч; без этой помехи — ${facts.unimpededSpeedKmh.toFixed(1)} км/ч.`,
    );
  }

  return details.join(' ');
}
