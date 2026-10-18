import { expandedCity } from '../../src/content/maps/expanded-city';

/** Choose a real south-to-north route using the same seeded traffic creation. */
export function equalRoadCity() {
  const map = structuredClone(expandedCity);

  const network = map.network!;

  const route = network.connections.find((item) => item.id === 'city-280-160-south-straight')!;

  network.lanes.sort(
    (a, b) => Number(b.id === route.fromLaneId) - Number(a.id === route.fromLaneId),
  );
  network.connections.sort((a, b) => Number(b.id === route.id) - Number(a.id === route.id));
  map.spawn = { x: 254, y: 163.5, heading: 0 };
  map.version = 'equal-road-test-1';

  return map;
}
