import { expect, it } from 'vitest';
import { CAUSE_CODES } from '../../src/domain/learning/question-types';
import { cause } from '../../src/domain/violations/causes';
import { isViolation } from '../../src/adapters/persistence/history-records';
import { prepareIncident } from '../../src/use-cases/session/prepare-incident';
import { emptyHistory } from '../../src/domain/world/model';

const paragraphs = {
  'stop-line': 'знак 2.5',
  'speed-limit': 'знак 3.24',
  'city-speed-limit': '10.2',
  'red-signal': '6.2, 6.13',
  'missing-indicator': '8.1, 8.2',
  'wrong-indicator': '8.1, 8.2',
  'late-indicator': '8.2',
  'early-indicator-off': '8.2',
  'pedestrian-obstruction': '14.1',
};

it.each(CAUSE_CODES)(
  'pins the checked explanation and applicable paragraph for %s without a question',
  (code) => {
    const reason = cause(code, {});

    const { entry } = prepareIncident({
      violations: [
        {
          type: reason.rule,
          causes: [reason],
          roadObjectId: 'road',
          episode: 1,
          speed: 3,
          tick: 1,
        },
      ],
      history: emptyHistory(),
      questions: [],
      tripId: 'trip',
      attemptId: 'attempt',
      mapVersion: 'map',
      environment: { id: () => 'event', date: () => '2026-10-14' },
    });

    expect(entry.material).toBeNull();
    expect(entry.causes[0].reference).toContain(paragraphs[code]);
    expect(entry.causes[0].referenceCheckedOn).toBe('2026-10-14');
    expect(entry.causes[0].referenceUrl).toMatch(
      /^https:\/\/www.consultant.ru\/document\/cons_doc_LAW_2709\//,
    );
    expect(entry.causes[0].explanation.length).toBeGreaterThan(50);
    expect(isViolation(JSON.parse(JSON.stringify(entry)))).toBe(true);

    const invalid = structuredClone(entry);

    invalid.causes[0].additionalReferences = [{ label: 'ПДД', url: 'javascript:alert(1)' }];
    expect(isViolation(invalid)).toBe(false);
  },
);

it('provides both applicable sources for speed and pedestrian obstruction', () => {
  expect(cause('speed-limit', {}).additionalReferences?.[0].label).toBe('Пункт 10.1');
  expect(cause('pedestrian-obstruction', {}).additionalReferences?.[0].label).toContain('1.2');
});
