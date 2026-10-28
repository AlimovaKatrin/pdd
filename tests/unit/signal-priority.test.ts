import { expect, it } from 'vitest';
import { expandedCity } from '../../src/content/maps/expanded-city';
import { junctionDuty } from '../../src/domain/world/junction-duty';
import { APPROACH_SIDES } from '../../src/domain/world/road-network';
import { compareJunctionPaths } from '../../src/domain/world/junction-priority';
import { signalColor } from '../../src/domain/world/traffic';

const network = expandedCity.network!;

const junction = network.junctions.find((item) => item.control === 'signals')!;

const routes = network.connections.filter((item) => item.junctionId === junction.id);

it.each([0, 599.5, 600, 779.5, 780, 899.5, 900, 1499.5, 1500, 1680, 1800])(
  'matches legal path relations and real signals for all approaches at tick %s',
  (tick) => {
    for (const first of routes) {
      for (const second of routes) {
        const approach = junction.approaches.find(
          (item) => item.incomingLaneId === first.fromLaneId,
        )!;

        const other = junction.approaches.find(
          (item) => item.incomingLaneId === second.fromLaneId,
        )!;

        const firstSignal = expandedCity.signals!.find((item) => item.id === approach.signalId)!;

        const secondSignal = expandedCity.signals!.find((item) => item.id === other.signalId)!;

        const relation = compareJunctionPaths(junction, first, second);

        const bothGreen =
          signalColor(firstSignal, tick) === 'green' && signalColor(secondSignal, tick) === 'green';

        const expected =
          bothGreen && relation.yields === 'first' && relation.reference === '13.4'
            ? 'priority-left-green'
            : null;

        expect(
          junctionDuty(
            expandedCity,
            { connectionId: first.id, enteredTick: null, entrySignal: null },
            { connectionId: second.id, enteredTick: null, entrySignal: null },
            tick,
          ),
          `${first.id} / ${second.id}`,
        ).toBe(expected);
      }
    }
  },
);

it.each(APPROACH_SIDES)('requires the %s approach to let a previous-phase car clear', (side) => {
  const route = routes.find((item) => item.id.endsWith(`-${side}-straight`))!;

  const perpendicular = APPROACH_SIDES[(APPROACH_SIDES.indexOf(side) + 1) % 4];

  const other = routes.find((item) => item.id.endsWith(`-${perpendicular}-straight`))!;

  const tick = side === 'north' || side === 'south' ? 1800 : 900;

  expect(
    junctionDuty(
      expandedCity,
      { connectionId: route.id, enteredTick: null, entrySignal: null },
      { connectionId: other.id, enteredTick: tick - 400, entrySignal: 'green' },
      tick,
    ),
  ).toBe('priority-clearing');
  expect(
    junctionDuty(
      expandedCity,
      { connectionId: other.id, enteredTick: tick - 400, entrySignal: 'green' },
      { connectionId: route.id, enteredTick: tick, entrySignal: 'green' },
      tick,
    ),
  ).toBeNull();
});
