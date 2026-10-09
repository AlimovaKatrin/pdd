import { expect, it } from 'vitest';
import { stopQuestion } from '../../src/content/questions/stop';
import { cause } from '../../src/domain/violations/causes';
import { emptyHistory, type DetectedViolation } from '../../src/domain/world/model';
import { prepareIncident } from '../../src/use-cases/session/prepare-incident';

function createContext() {
  let nextId = 0;

  const violation: DetectedViolation = {
    type: 'stop',
    roadObjectId: 'stop-a',
    episode: 1,
    speed: 5,
    tick: 100,
    causes: [cause('stop-line', { speed: 5 })],
  };

  return {
    violations: [violation] as [DetectedViolation, ...DetectedViolation[]],
    history: emptyHistory(),
    questions: [structuredClone(stopQuestion)],
    tripId: 'trip',
    attemptId: 'attempt',
    mapVersion: 'map',
    environment: { id: () => String(++nextId), date: () => '2026-10-09T12:00:00Z' },
  };
}

it('deduplicates causes only within the same road object and episode, keeping the first facts', () => {
  const context = createContext();

  const original = context.violations[0];

  context.violations.push(
    { ...original, causes: [cause('stop-line', { speed: 7 })] },
    { ...original, roadObjectId: 'stop-b' },
    { ...original, episode: 2 },
  );

  const before = structuredClone(context.violations);

  const { entry } = prepareIncident(context);

  expect(entry.causes.map((cause) => cause.facts)).toEqual([
    { speed: 5, roadObjectId: 'stop-a', episode: 1 },
    { speed: 5, roadObjectId: 'stop-b', episode: 1 },
    { speed: 5, roadObjectId: 'stop-a', episode: 2 },
  ]);
  expect(entry.eventKeys).toEqual(['stop:stop-a:1', 'stop:stop-b:1', 'stop:stop-a:2']);
  expect(context.violations).toEqual(before);
});

it('keeps the original incident identity and question when a later stage adds causes', () => {
  const context = createContext();

  const original = prepareIncident(context).entry;

  context.history.violations.push(original);

  const before = structuredClone(context.history);

  context.questions[0].version = 'updated';
  context.violations[0].causes.push(cause('speed-limit', { speed: 40, limit: 30 }));

  const { entry, isNew } = prepareIncident(context);

  expect(isNew).toBe(false);
  expect(entry.id).toBe(original.id);
  expect(entry.date).toBe(original.date);
  expect(entry.causes.map((cause) => cause.code)).toEqual(['stop-line', 'speed-limit']);
  expect(entry.material).toEqual(stopQuestion);
  expect(entry.material).not.toBe(original.material);
  expect(context.history).toEqual(before);
});

it('keeps missing material for the current episode but selects anew for a retry', () => {
  const context = createContext();

  const original = prepareIncident({ ...context, questions: [] }).entry;

  context.history.violations.push(original);

  const continued = prepareIncident(context);

  expect(continued.isNew).toBe(false);
  expect(continued.entry.material).toBeNull();
  expect(continued.entry.materialUnavailable).toBeTruthy();

  const retry = prepareIncident({ ...context, attemptId: 'retry' });

  expect(retry.isNew).toBe(true);
  expect(retry.entry.id).not.toBe(original.id);
  expect(retry.entry.material).toEqual(stopQuestion);
  expect(retry.entry.materialUnavailable).toBeUndefined();
});
