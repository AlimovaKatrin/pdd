import { describe, expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { neighborhood } from '../../src/content/maps/neighborhood';
import { initialWorld } from '../../src/domain/world/model';
import {
  laneAt,
  laneOccupation,
  sweptLaneIds,
  connectionForVehicle,
} from '../../src/domain/world/road-context';
import { validateMap } from '../../src/domain/world/validate-map';
import { positionAlongPath, pathLength } from '../../src/domain/world/path-geometry';
import { compareJunctionPaths } from '../../src/domain/world/junction-priority';

const network = expandedCity.network!;

describe('four-block road data', () => {
  it('loads the old map and the connected four-block map with every allowed movement', () => {
    expect(validateMap(neighborhood)).toBe(neighborhood);
    expect(validateMap(expandedCity)).toBe(expandedCity);
    expect(network.lanes).toHaveLength(48);
    expect(network.junctions).toHaveLength(9);
    expect(network.connections).toHaveLength(108);
    expect(new Set(network.junctions.map((j) => j.control))).toEqual(
      new Set(['signals', 'priority', 'equal']),
    );
  });

  it.each([
    'duplicate',
    'geometry',
    'direction',
    'link',
    'movement',
    'endpoint',
    'missing',
    'safe',
    'signal',
    'priority',
  ])('rejects invalid %s data at loading', (defect) => {
    const map = structuredClone(expandedCity);

    const data = map.network!;

    if (defect === 'duplicate') {
      data.lanes.push(data.lanes[0]);
    }

    if (defect === 'geometry') {
      data.lanes[0].to = { ...data.lanes[0].from };
    }

    if (defect === 'direction') {
      data.lanes[0].approach = 'south';
    }

    if (defect === 'link') {
      data.lanes[0].oppositeLaneId = 'missing';
    }

    if (defect === 'movement') {
      data.connections[0].movement = 'right';
    }

    if (defect === 'endpoint') {
      data.connections[0].path[0].x += 1;
    }

    if (defect === 'missing') {
      data.connections.pop();
    }

    if (defect === 'safe') {
      data.safePositions[0].x = 0;
    }

    if (defect === 'signal') {
      delete data.junctions.find((j) => j.control === 'signals')!.approaches[0].signalId;
    }

    if (defect === 'priority') {
      data.junctions.find((j) => j.control === 'priority')!.approaches[0].priority = 'equal';
    }

    expect(() => validateMap(map)).toThrow('Invalid road network');
  });

  it('locates both lanes by footprint, tracks swept crossings and resolves actual turns', () => {
    const vehicle = initialWorld(expandedCity).vehicle;

    const lane = laneAt(network, vehicle);

    expect(lane.approach).toBe('south');
    expect(laneOccupation(lane, vehicle).contained).toBe(true);

    const boundaryPose = { ...vehicle, x: 160.5 };

    expect(laneOccupation(lane, boundaryPose).contained).toBe(false);
    expect(
      laneOccupation(
        network.lanes.find((item) => item.id === lane.oppositeLaneId)!,
        boundaryPose,
      ).overlaps,
    ).toBe(true);

    const crossed = sweptLaneIds(network, vehicle, { ...vehicle, x: 155 });

    expect(crossed).toContain(lane.id);
    expect(crossed).toContain(lane.oppositeLaneId);

    for (const connection of network.connections) {
      const pose = positionAlongPath(connection.path, pathLength(connection.path) * 0.65);

      expect(
        connectionForVehicle(network, connection.fromLaneId, { ...vehicle, ...pose })?.id,
      ).toBe(connection.id);
    }
  });
});

describe('junction movement tables', () => {
  it('covers every ordered pair, is symmetric, and never contradicts itself', () => {
    for (const junction of network.junctions) {
      const paths = network.connections.filter((path) => path.junctionId === junction.id);

      expect(paths).toHaveLength(12);

      for (const first of paths) {
        for (const second of paths) {
          const forward = compareJunctionPaths(junction, first, second);

          const reverse = compareJunctionPaths(junction, second, first);

          expect(forward.conflict).toBe(reverse.conflict);
          expect(forward.reference).toBe(reverse.reference);
          expect(reverse.yields).toBe(
            forward.yields === 'first'
              ? 'second'
              : forward.yields === 'second'
                ? 'first'
                : forward.yields,
          );

          if (forward.conflict && forward.yields === 'neither') {
            throw new Error(`Unresolved conflicting pair: ${first.id}, ${second.id}`);
          }
        }
      }
    }
  });

  it('keeps opposing straight and opposing left turns compatible at every junction', () => {
    for (const junction of network.junctions) {
      for (const movement of ['straight', 'left'] as const) {
        const first = network.connections.find((c) => c.id === `${junction.id}-north-${movement}`)!;

        const second = network.connections.find(
          (c) => c.id === `${junction.id}-south-${movement}`,
        )!;

        expect(compareJunctionPaths(junction, first, second)).toEqual({
          conflict: false,
          yields: 'neither',
          reference: null,
        });
      }
    }
  });

  it('uses green left-turn, main-road and right-hand precedence only in their own contexts', () => {
    for (const control of ['signals', 'priority', 'equal'] as const) {
      const junction = network.junctions.find((j) => j.control === control)!;

      const path = (side: string, movement: string) =>
        network.connections.find((c) => c.id === `${junction.id}-${side}-${movement}`)!;

      const left = compareJunctionPaths(junction, path('north', 'left'), path('south', 'straight'));

      expect(left.yields).toBe('first');
      expect(left.reference).toBe(control === 'signals' ? '13.4' : '13.12');

      const crossing = compareJunctionPaths(
        junction,
        path('north', 'straight'),
        path('west', 'straight'),
      );

      expect(crossing.yields).toBe(control === 'signals' ? 'signals' : 'first');
      expect(crossing.reference).toBe(
        control === 'signals' ? '6.2, 13.8' : control === 'priority' ? '13.9' : '13.11',
      );
    }
  });
});
