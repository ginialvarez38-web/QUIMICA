/**
 * Empaqueta el sandbox en un UNICO archivo HTML autocontenido.
 *
 * Un artefacto publicado no puede cargar scripts propios desde una ruta
 * relativa: solo admite scripts de unos pocos CDN permitidos. Como todo el
 * codigo de este proyecto es propio, hay que incrustarlo.
 *
 * El HTML resultante NO lleva <!doctype>, <html>, <head> ni <body>: el
 * publicador envuelve el archivo en ese esqueleto. Se emite el <title>, el
 * <style> y el contenido del cuerpo, en ese orden.
 *
 *   node scripts/build-artifact.mjs
 *
 * Requiere haber ejecutado antes `npm run build` y tener `bun` disponible
 * para el empaquetado de modulos.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'chemical-sandbox.html');
const BUNDLE = join(ROOT, 'dist', 'bundle.js');

// --- 1. Empaquetar los modulos en un solo archivo --------------------------

execFileSync(
  'bun',
  ['build', join(ROOT, 'dist/src/ui/app.js'), '--target=browser', '--minify', '--outfile', BUNDLE],
  { stdio: 'inherit', env: { ...process.env, PATH: `/root/.bun/bin:${process.env.PATH}` } },
);

const script = await readFile(BUNDLE, 'utf8');
const css = await readFile(join(ROOT, 'web/styles/app.css'), 'utf8');
const html = await readFile(join(ROOT, 'web/index.html'), 'utf8');

// --- 2. Extraer el cuerpo, sin la etiqueta de script externa ---------------

const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(html);
if (!bodyMatch) throw new Error('No se ha encontrado el <body> en web/index.html');

const body = bodyMatch[1]
  .replace(/<script[^>]*src=[^>]*><\/script>/g, '')
  .trim();

// --- 3. Componer -----------------------------------------------------------

// El cierre de una etiqueta de script dentro de una cadena del propio script
// terminaria el bloque antes de tiempo. Se parte en dos.
const safeScript = script.replace(/<\/script/gi, '<\\/script');

const output = `<title>Chemical Sandbox</title>
<style>
${css}
</style>

${body}

<script type="module">
${safeScript}
</script>
`;

await writeFile(OUT, output, 'utf8');

const kb = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(0);
console.log(`\n  ${OUT}\n  ${kb} KB en un solo archivo\n`);
