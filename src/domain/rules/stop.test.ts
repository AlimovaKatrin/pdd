import { describe, expect, it } from 'vitest';
import { checkStop } from './stop';
import type { StopEpisode, StopLine, Vehicle } from '../world/model';
const line: StopLine = {
  id: 'any-road',
  a: { x: 0, y: 10 },
  b: { x: 7, y: 10 },
  direction: { x: 0, y: -1 },
};
const car = (y: number, speed = 4, x = 3.5): Vehicle => ({
  x,
  y,
  speed,
  heading: -Math.PI / 2,
  indicator: null,
  indicatorTurn: 0,
});
const ready = (): StopEpisode => ({ phase: 'ready', stopped: false, number: 1 });
describe('STOP domain', () => {
  it('detects the front bumper crossing even between distant frames', () => {
    const result = checkStop(car(17), car(8), line, ready(), 2);
    expect(result.violation?.roadObjectId).toBe('any-road');
    expect(result.episode.phase).toBe('crossed');
  });
  it.each([13, 14.1, 15.1])('accepts a complete stop at y=%s within 3 m before the line', (y) => {
    const stop = checkStop(car(y), car(y, 0), line, ready(), 1);
    expect(stop.episode.stopped).toBe(true);
    const result = checkStop(car(y, 0), car(11), line, stop.episode, 2);
    expect(result.violation).toBeUndefined();
    expect(result.passed).toBe(true);
  });
  it('does not treat crawling as a complete stop', () => {
    const stop = checkStop(car(13), car(13, 0.1), line, ready(), 1);
    expect(checkStop(car(13), car(11), line, stop.episode, 2).violation).toBeDefined();
  });
  it('does not count a remote or post-line stop', () => {
    for (const y of [15.11, 17, 11]) {
      expect(checkStop(car(y), car(y, 0), line, ready(), 1).episode.stopped).toBe(false);
    }
  });
  it('does not repeat the same episode and rearms on a new approach', () => {
    const crossed = checkStop(car(13), car(11), line, ready(), 1).episode;
    expect(checkStop(car(13), car(11), line, crossed, 2).violation).toBeUndefined();
    const rearmed = checkStop(car(11), car(40), line, crossed, 3).episode;
    expect(rearmed.number).toBe(2);
    expect(checkStop(car(13), car(11), line, rearmed, 4).violation?.episode).toBe(2);
  });
  it('ignores adjacent lanes and the opposite direction', () => {
    expect(checkStop(car(13, 4, -4), car(11, 4, -4), line, ready(), 1).violation).toBeUndefined();
    expect(checkStop(car(11), car(13), line, ready(), 1).violation).toBeUndefined();
    expect(checkStop(car(13, -4), car(11, -4), line, ready(), 1).violation).toBeUndefined();
  });
  it('counts leaving an exact line position without a stop', () => {
    expect(checkStop(car(12.1), car(11.9), line, ready(), 1).violation).toBeDefined();
  });
});
