import { createServer, type RequestListener, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlantUmlSvgUrl, fetchPlantUmlSvg, validatePlantUmlServer } from './plantuml-server';

const servers: Server[] = [];

const startServer = async (handler: RequestListener): Promise<{ server: Server; url: string }> => {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
  return { server, url: `http://127.0.0.1:${address.port}/plantuml` };
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe('PlantUML server client', () => {
  it('encodes source into a normalized SVG endpoint', () => {
    const url = createPlantUmlSvgUrl(
      'https://www.plantuml.com/plantuml/',
      '@startuml\nAlice -> Bob\n@enduml',
    );

    expect(url).toMatch(/^https:\/\/www\.plantuml\.com\/plantuml\/svg\/[\w-]+$/);
    expect(url).not.toContain('@startuml');
  });

  it('renders and validates against a local server', async () => {
    const requestedPaths: string[] = [];
    const { url } = await startServer((request, response) => {
      requestedPaths.push(request.url ?? '');
      response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      response.end('<svg xmlns="http://www.w3.org/2000/svg"><text>selectable</text></svg>');
    });

    const svg = await fetchPlantUmlSvg(
      url,
      '@startuml\nAlice -> Bob\n@enduml',
      new AbortController().signal,
    );
    expect(svg).toContain('<text>selectable</text>');
    await expect(validatePlantUmlServer(`${url}/`, new AbortController().signal)).resolves.toBe(
      url,
    );
    expect(requestedPaths).toHaveLength(2);
    expect(requestedPaths.every((path) => path.startsWith('/plantuml/svg/'))).toBe(true);
  });

  it('reports server failures and invalid responses', async () => {
    const failure = await startServer((_request, response) => {
      response.writeHead(503);
      response.end('unavailable');
    });
    const invalid = await startServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<html>not svg</html>');
    });

    await expect(
      fetchPlantUmlSvg(failure.url, '@startuml\n@enduml', new AbortController().signal),
    ).rejects.toThrow('HTTP 503');
    await expect(
      fetchPlantUmlSvg(invalid.url, '@startuml\n@enduml', new AbortController().signal),
    ).rejects.toThrow('有效的 SVG');
    await expect(validatePlantUmlServer('not-a-url', new AbortController().signal)).rejects.toThrow(
      '有效的 HTTP',
    );
  });

  it('cancels a request that has not completed', async () => {
    let requestStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const { url } = await startServer(() => requestStarted?.());
    const controller = new AbortController();
    const rendering = fetchPlantUmlSvg(url, '@startuml\n@enduml', controller.signal);

    await started;
    controller.abort();
    await expect(rendering).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('honors a timeout signal while waiting for a local server', async () => {
    const { url } = await startServer(() => undefined);

    await expect(
      fetchPlantUmlSvg(url, '@startuml\n@enduml', AbortSignal.timeout(30)),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
