import { expandedCity } from '../../src/content/maps/expanded-city';

/** A valid map ordering makes the fixed seed choose an opposing straight route first. */
export function priorityCity() {
  const map = structuredClone(expandedCity);

  const network = map.network!;

  const route = network.connections.find((item) => item.id === 'city-160-160-north-straight')!;

  network.lanes.sort(
    (a, b) => Number(b.id === route.fromLaneId) - Number(a.id === route.fromLaneId),
  );
  network.connections.sort((a, b) => Number(b.id === route.id) - Number(a.id === route.id));
  map.spawn = { x: 163.5, y: 195, heading: -Math.PI / 2 };
  map.version = 'priority-test-1';

  return map;
}

export function mainRoadCity() {
  const map = structuredClone(expandedCity);

  const network = map.network!;

  const route = network.connections.find((item) => item.id === 'city-160-40-west-straight')!;

  network.lanes.sort(
    (a, b) => Number(b.id === route.fromLaneId) - Number(a.id === route.fromLaneId),
  );
  network.connections.sort((a, b) => Number(b.id === route.id) - Number(a.id === route.id));
  map.spawn = { x: 156.5, y: 14, heading: Math.PI / 2 };
  map.version = 'main-road-test-1';

  return map;
}
