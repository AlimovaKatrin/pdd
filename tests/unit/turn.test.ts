import { describe, expect, it } from 'vitest';
import { neighborhood } from '../../src/content/maps/neighborhood';
import {
  initialWorld,
  type Indicator,
  type Vehicle,
  type World,
} from '../../src/domain/world/model';
import { checkTurn } from '../../src/domain/maneuvers/turn';

function enterIntersection(indicator: Indicator = 'right') {
  const previous = initialWorld(neighborhood);

  previous.vehicle = { ...previous.vehicle, x: 64, y: 50, heading: 0, speed: 4, indicator };

  return advance(previous).world;
}

function advance(previous: World, changes: Partial<Vehicle> = {}) {
  const world = structuredClone(previous);

  world.tick++;
  Object.assign(world.vehicle, changes);

  const violations = checkTurn(previous, world, neighborhood);

  return { world, violations };
}

describe('turn boundaries', () => {
  it.each([
    [0.04, false],
    [0.040001, true],
    [-0.04, false],
    [-0.040001, true],
  ])('starts tracking at heading %s: %s', (heading, turning) => {
    const previous = enterIntersection();

    const { world, violations } = advance(previous, { heading });

    expect(world.maneuver?.turning).toBe(turning);
    expect(world.maneuver?.confirmed).toBe(false);
    expect(violations).toEqual([]);
  });

  it.each([
    [0.349999, false],
    [0.35, true],
    [-0.349999, false],
    [-0.35, true],
  ])('confirms a turn at heading %s: %s', (heading, confirmed) => {
    const indicator = heading > 0 ? 'right' : 'left';

    const { world, violations } = advance(enterIntersection(indicator), { heading });

    expect(world.maneuver?.confirmed).toBe(confirmed);
    expect(world.maneuver?.direction).toBe(confirmed ? indicator : null);
    expect(violations).toEqual([]);
  });

  it.each([
    [75, 0.7, false],
    [75.001, 0.699999, false],
    [75.001, 0.7, true],
  ])('finishes at x=%s, heading=%s: %s', (x, heading, finished) => {
    const confirmed = advance(enterIntersection(), { heading: 0.35 }).world;

    const { world, violations } = advance(confirmed, { x, heading });

    expect(world.vehicle.indicator).toBe(finished ? null : 'right');
    expect(world.maneuver === null).toBe(x > 75);
    expect(violations).toEqual([]);
  });

  it('uses the indicator before the first steering step and keeps the previous world unchanged', () => {
    const previous = enterIntersection(null);

    const before = structuredClone(previous);

    const started = advance(previous, { heading: 0.1, indicator: 'right' }).world;

    const { world, violations } = advance(started, { heading: 0.35 });

    expect(previous).toEqual(before);
    expect(previous.maneuver?.reported).toEqual([]);
    expect(started.maneuver?.reported).toEqual([]);
    expect(world.maneuver?.startTick).toBe(started.tick);
    expect(world.maneuver?.initialIndicator).toBeNull();
    expect(violations[0].causes.map((cause) => cause.code)).toEqual([
      'missing-indicator',
      'late-indicator',
    ]);
    expect(advance(world, { heading: 0.5 }).violations).toEqual([]);
  });

  it('does not report premature switch-off on the step that completes the turn', () => {
    const confirmed = advance(enterIntersection(), { heading: 0.35 }).world;

    const { world, violations } = advance(confirmed, { x: 80, heading: 0.7, indicator: null });

    expect(world.maneuver).toBeNull();
    expect(violations).toEqual([]);
  });

  it.each([0, -1])('does not start a new episode at speed %s', (speed) => {
    const previous = initialWorld(neighborhood);

    const { world, violations } = advance(previous, { x: 64, y: 50, speed, heading: 1 });

    expect(world.maneuver).toBeNull();
    expect(world.maneuverNumber).toBe(0);
    expect(violations).toEqual([]);
  });
});
