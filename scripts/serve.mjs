/**
 * Servidor estatico minimo para desarrollo.
 *
 * Sirve `web/` como raiz y `dist/` para los modulos compilados, que es la
 * estructura que espera `web/index.html`. Sin dependencias: el modulo `http`
 * de Node basta.
 *
 *   node scripts/serve.mjs [puerto]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
};

/** Resuelve la URL a un fichero real, impidiendo salir del proyecto. */
async function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const candidates =
    clean === '/' || clean === ''
      ? [join(ROOT, 'web', 'index.html')]
      : [join(ROOT, 'web', clean), join(ROOT, clean)];

  for (const candidate of candidates) {
    const resolved = normalize(candidate);
    // Nunca se sirve nada fuera del directorio del proyecto.
    if (!resolved.startsWith(ROOT)) continue;
    try {
      const info = await stat(resolved);
      if (info.isFile()) return resolved;
      if (info.isDirectory()) {
        const index = join(resolved, 'index.html');
        const indexInfo = await stat(index).catch(() => null);
        if (indexInfo?.isFile()) return index;
      }
    } catch {
      // siguiente candidato
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const filePath = await resolvePath(req.url ?? '/');

  if (!filePath) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`404 — no encontrado: ${req.url}`);
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`500 — ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`\n  CHEMICAL SANDBOX\n  http://localhost:${PORT}\n`);
  console.log('  Compila con `npm run build` (o `npm run watch`) antes de recargar.\n');
});
