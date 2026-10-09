import { expect, it } from 'vitest';
import { neighborhood } from '../../src/content/maps/neighborhood';
import { checkPedestrians } from '../../src/domain/rules/pedestrians';
import { initialWorld } from '../../src/domain/world/model';

it('reports a new forced stop without changing either world and does not repeat the episode', () => {
  const previous = initialWorld(neighborhood);

  const next = structuredClone(previous);

  next.pedestrians['park-crossing'] = {
    ...next.pedestrians['park-crossing'],
    reaction: 'vehicle',
    obstructed: true,
    progress: 0.25,
  };

  const before = structuredClone({ previous, next });

  const violations = checkPedestrians(previous, next, neighborhood);

  expect(violations).toHaveLength(1);
  expect(violations[0].causes[0].code).toBe('pedestrian-obstruction');
  expect({ previous, next }).toEqual(before);
  expect(checkPedestrians(next, structuredClone(next), neighborhood)).toEqual([]);
});

it('does not infer an obstruction when the pedestrian has no reaction to the vehicle', () => {
  const previous = initialWorld(neighborhood);

  const next = structuredClone(previous);

  next.pedestrians['park-crossing'].progress = 0.25;
  expect(checkPedestrians(previous, next, neighborhood)).toEqual([]);
});
