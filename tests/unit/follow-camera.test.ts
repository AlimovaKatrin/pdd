import { expect, it } from 'vitest';
import { nextCameraCentre } from '../../src/presentation/phaser/follow-camera';

it('follows smoothly, freezes with simulation time and snaps on return or rewind', () => {
  const centre = { x: 40, y: 195 };

  const before = { ...centre, tick: 100 };

  const after = { x: 40, y: 194, tick: 101 };

  const followed = nextCameraCentre(centre, before, after);

  expect(followed.y).toBeLessThan(195);
  expect(followed.y).toBeGreaterThan(194);
  expect(nextCameraCentre(followed, after, after)).toBe(followed);
  expect(nextCameraCentre(followed, after, { x: 160, y: 100, tick: 102 })).toEqual({
    x: 160,
    y: 100,
  });
  expect(nextCameraCentre(followed, after, { ...centre, tick: 0 })).toEqual(centre);
});

it('snaps a short relocation even when simulation time has not advanced', () => {
  expect(
    nextCameraCentre(
      { x: 10, y: 10 },
      { x: 10, y: 10, tick: 60, relocation: 0 },
      { x: 12, y: 10, tick: 60, relocation: 1 },
    ),
  ).toEqual({ x: 12, y: 10 });
});
