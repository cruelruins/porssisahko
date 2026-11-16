'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const SITE_DIR = path.join(__dirname, 'site');

const PRICE_API =
  'https://api.porssisahko.net/v2/latest-prices.json';

const CACHE_DURATION_MS = 60 * 1000;

let priceCache = null;
let priceCacheTime = 0;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });

  response.end(JSON.stringify(data));
}

async function servePrices(response) {
  try {
    const now = Date.now();

    if (priceCache && now - priceCacheTime < CACHE_DURATION_MS) {
      sendJson(response, 200, priceCache);
      return;
    }

    const apiResponse = await fetch(PRICE_API, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'porssivirta/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!apiResponse.ok) {
      throw new Error(
        `Price service returned HTTP ${apiResponse.status}`
      );
    }

    const data = await apiResponse.json();

    if (!data || !Array.isArray(data.prices)) {
      throw new Error('Price service returned invalid data');
    }

    priceCache = data;
    priceCacheTime = now;

    sendJson(response, 200, data);
  } catch (error) {
    console.error('Price request failed:', error);

    if (priceCache) {
      sendJson(response, 200, priceCache);
      return;
    }

    sendJson(response, 502, {
      error: 'Hintatietojen hakeminen epäonnistui.',
    });
  }
}

function serveStaticFile(request, response) {
  let requestPath;

  try {
    requestPath = decodeURIComponent(
      new URL(request.url, `http://${request.headers.host}`).pathname
    );
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  if (requestPath === '/') {
    requestPath = '/index.html';
  }

  const filePath = path.resolve(
    SITE_DIR,
    `.${requestPath}`
  );

  if (
    filePath !== SITE_DIR &&
    !filePath.startsWith(`${SITE_DIR}${path.sep}`)
  ) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();

    response.writeHead(200, {
      'Content-Type':
        contentTypes[extension] || 'application/octet-stream',
    });

    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(
    request.url,
    `http://${request.headers.host}`
  ).pathname;

  if (request.method === 'GET' && pathname === '/api/prices') {
    await servePrices(response);
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    serveStaticFile(request, response);
    return;
  }

  response.writeHead(405, {
    Allow: 'GET, HEAD',
    'Content-Type': 'text/plain; charset=utf-8',
  });

  response.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Pörssivirta listening on port ${PORT}`);
});
