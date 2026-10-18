import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';

const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const { expandedCity } = await server.ssrLoadModule('/src/content/maps/expanded-city.ts');

  const { compareJunctionPaths } = await server.ssrLoadModule(
    '/src/domain/world/junction-priority.ts',
  );

  const { network } = expandedCity;

  const rows = ['junction,control,first,second,conflict,yields,pdd'];

  for (const junction of network.junctions) {
    const paths = network.connections.filter((connection) => connection.junctionId === junction.id);

    for (const first of paths) {
      for (const second of paths) {
        const relation = compareJunctionPaths(junction, first, second);

        rows.push(
          [
            junction.id,
            junction.control,
            first.id,
            second.id,
            relation.conflict,
            relation.yields,
            `"${relation.reference ?? ''}"`,
          ].join(','),
        );
      }
    }
  }

  const elements = [];

  for (const road of expandedCity.roads) {
    elements.push(
      `<rect x="${road.x}" y="${road.y}" width="${road.width}" height="${road.height}" fill="#cad1cc"/>`,
    );
  }

  for (const boundary of network.boundaries) {
    elements.push(
      `<path d="M${boundary.from.x},${boundary.from.y} L${boundary.to.x},${boundary.to.y}" stroke="#fff" stroke-width="0.7"/>`,
    );
  }

  for (const junction of network.junctions) {
    const label = { signals: 'Светофор', priority: 'Главная ↔', equal: 'Равнозначный' }[
      junction.control
    ];

    elements.push(
      `<circle cx="${junction.x}" cy="${junction.y}" r="10" fill="#f9faf4" stroke="#305d49" stroke-width="0.5"/>`,
    );
    elements.push(
      `<text x="${junction.x}" y="${junction.y - 1}" text-anchor="middle" font-size="3.2">${label}</text>`,
    );
    elements.push(
      `<text x="${junction.x}" y="${junction.y + 4}" text-anchor="middle" font-size="3">${junction.x};${junction.y}</text>`,
    );
  }

  for (const stop of expandedCity.stops) {
    elements.push(
      `<path d="M${stop.a.x},${stop.a.y} L${stop.b.x},${stop.b.y}" stroke="#b43835" stroke-width="1"/>`,
    );
  }

  for (const point of network.safePositions) {
    elements.push(`<circle cx="${point.x}" cy="${point.y}" r="1.5" fill="#268345"/>`);
  }

  elements.push(
    '<text x="100" y="39" text-anchor="middle" font-size="4" fill="#a93232">30 →</text>',
  );
  elements.push('<text x="25" y="222" text-anchor="middle" font-size="3.5">Переход</text>');
  elements.push(
    '<circle cx="163.5" cy="220" r="2.5" fill="#286bc1"/><text x="168" y="221" font-size="4">Старт ↑</text>',
  );

  for (const [x, y, label] of [
    [100, 100, 'Сад'],
    [220, 100, 'Мастерские'],
    [100, 220, 'Парк'],
    [220, 220, 'Площадь'],
  ]) {
    elements.push(
      `<text x="${x}" y="${y}" text-anchor="middle" font-size="6" fill="#526b54">${label}</text>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="960" height="960" role="img" aria-labelledby="title"><title id="title">Схема четырёх кварталов: дороги, приоритет и безопасные позиции</title><rect width="320" height="320" fill="#eef2e5"/><g font-family="Arial, sans-serif" fill="#253e34">${elements.join('')}</g></svg>\n`;

  for (const [path, content] of [
    ['docs/implementation/0.3.0/conflicts.csv', `${rows.join('\n')}\n`],
    ['docs/implementation/0.3.0/city-plan.svg', svg],
  ]) {
    if (process.argv.includes('--check')) {
      if ((await readFile(path, 'utf8')) !== content) {
        throw new Error(`Outdated city artifact: ${path}`);
      }
    } else {
      await writeFile(path, content);
    }
  }
} finally {
  await server.close();
}
