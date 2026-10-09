import { describe, expect, it } from 'vitest';
import { neighborhood } from '../../src/content/maps/neighborhood';
import { initialWorld } from '../../src/domain/world/model';
import { stepPedestrians } from '../../src/domain/simulation/pedestrians';

const map = neighborhood;

describe('pedestrian intention and reaction', () => {
  function encounter(x: number, y: number, speed: number) {
    const prev = initialWorld(map);

    prev.pedestrians['park-crossing'].progress = 0.25;
    prev.vehicle = { ...prev.vehicle, x, y, speed, heading: Math.PI / 2 };

    return { prev, next: structuredClone(prev) };
  }

  it('records forced braking and not proximity or a proper stop before the crossing', () => {
    const blocked = encounter(20.5, 64, 6);

    const events = stepPedestrians(blocked.prev, blocked.next, map, 1 / 60);

    expect(events).toHaveLength(1);
    expect(events[0].causes[0].facts).toMatchObject({
      priority: true,
      actualSpeed: 0,
      reaction: 'braking-for-vehicle',
    });
    expect(blocked.next.pedestrians['park-crossing'].progress).toBe(0.25);

    const yielding = encounter(20.5, 63, 0);

    expect(stepPedestrians(yielding.prev, yielding.next, map, 1 / 60)).toEqual([]);
    expect(yielding.next.pedestrians['park-crossing'].progress).toBeGreaterThan(0.25);

    const near = encounter(27.5, 64, 0);

    expect(stepPedestrians(near.prev, near.next, map, 1 / 60)).toEqual([]);
  });
  it('deduplicates an encounter, rearms after crossing and repeats deterministically', () => {
    const { prev, next } = encounter(20.5, 64, 6);

    stepPedestrians(prev, next, map, 1 / 60);

    const replay = structuredClone(prev);

    stepPedestrians(prev, replay, map, 1 / 60);
    expect(next).toEqual(replay);

    const after = structuredClone(next);

    expect(stepPedestrians(next, after, map, 1 / 60)).toEqual([]);
    after.pedestrians['park-crossing'] = {
      progress: 1,
      waiting: 1,
      episode: 1,
      obstructed: true,
      reaction: null,
    };

    const reset = structuredClone(after);

    stepPedestrians(after, reset, map, 1 / 60);
    expect(reset.pedestrians['park-crossing']).toMatchObject({
      progress: 0,
      episode: 2,
      obstructed: false,
    });
  });
});
