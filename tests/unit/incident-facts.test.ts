import { expect, it } from 'vitest';
import { CAUSE_CODES } from '../../src/domain/learning/question-types';
import { cause } from '../../src/domain/violations/causes';
import { formatCauseFacts } from '../../src/presentation/view-models/incident';

it.each(CAUSE_CODES)('does not invent missing historic facts for %s', (code) => {
  const text = formatCauseFacts(cause(code, {}));

  expect(text).not.toMatch(/undefined|NaN/);

  if (code !== 'stop-line') {
    expect(text).toMatch(/не сохран/);
  }
});

it('preserves the stored participant identity and priority without consulting the current map', () => {
  const text = formatCauseFacts(
    cause('priority-main', {
      participantId: 'retired-car',
      participantLabel: 'M7',
      participantFrom: 'west',
      playerFrom: 'north',
      playerMovement: 'straight',
      participantMovement: 'right',
      control: 'priority',
      playerPriority: 'secondary',
      participantPriority: 'main',
      reaction: 'player-obstruction',
      actualSpeedKmh: 5,
      unimpededSpeedKmh: 8,
    }),
  );

  expect(text).toContain('M7');
  expect(text).toContain('5.0');
  expect(text).toContain('8.0');
});
