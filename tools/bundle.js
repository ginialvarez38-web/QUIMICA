/**
 * Bundle CHEMIA into a single self-contained HTML file.
 *
 * There is no bundler available (the npm registry is unreachable from the
 * build environment), so `tsc` is asked to emit every module into one file in
 * System format and this script supplies the ~30-line loader that runs it.
 * Nothing is fetched at runtime: the styles are inlined, the module graph is
 * inlined, and the icons are already SVG built by the application itself.
 *
 *   node tools/bundle.js            → dist/chemia.html      (artefact body)
 *                                     dist/chemia-test.html (same, wrapped for
 *                                     local verification in a real browser)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// The order matters: tokens define the variables every later sheet consumes.
const STYLESHEETS = [
  'styles/tokens.css',
  'styles/base.css',
  'styles/layout.css',
  'styles/components.css',
  'styles/modules.css',
];

const css = STYLESHEETS.map((f) => `/* ${f} */\n${read(f)}`).join('\n');
const modules = read('build-bundle/chemia.js');

/*
 * A minimal System.register loader.
 *
 * `declare` is evaluated first and returns setters plus an execute body; the
 * module's export object is registered *before* its dependencies are loaded,
 * which is what makes import cycles resolve to a live object rather than to
 * undefined. Dependencies are then loaded depth-first and bound through the
 * setters, exactly as the format intends.
 */
const loader = `
var System = (function () {
  var defs = Object.create(null), mods = Object.create(null);
  return {
    register: function (name, deps, declare) {
      defs[name] = { deps: deps, declare: declare };
    },
    import: function load(name) {
      if (name in mods) return mods[name];
      var def = defs[name];
      if (!def) throw new Error('CHEMIA: modulo no encontrado: ' + name);
      var exported = Object.create(null);
      mods[name] = exported;
      var record = def.declare(function (key, value) {
        if (key !== null && typeof key === 'object') {
          for (var prop in key) exported[prop] = key[prop];
        } else {
          exported[key] = value;
        }
        return value;
      }, { id: name });
      var resolved = def.deps.map(load);
      record.setters.forEach(function (set, i) { set(resolved[i]); });
      record.execute();
      return exported;
    },
  };
})();
`.trim();

const boot = `
try {
  System.import('main');
} catch (error) {
  document.getElementById('app').innerHTML =
    '<div style="padding:3rem;max-width:70ch;margin:0 auto;line-height:1.6">'
    + '<h1 style="font-size:1.5rem">No se pudo iniciar CHEMIA</h1>'
    + '<p>Los motores de simulacion no arrancaron. El detalle tecnico:</p>'
    + '<pre style="white-space:pre-wrap;font-size:.85rem;color:#a11">'
    + String(error && error.stack || error).replace(/[<&]/g, function (c) {
        return c === '<' ? '&lt;' : '&amp;';
      })
    + '</pre></div>';
  throw error;
}
`.trim();

/*
 * Runs before first paint. It records the theme the host has already chosen
 * for the reader, so that CHEMIA's own "del sistema" setting defers to it
 * instead of clearing it, and then applies the reader's saved CHEMIA theme so
 * the page never flashes the wrong ground colour.
 */
const prepaint = `
(function () {
  var root = document.documentElement;
  window.__chemiaHostTheme = root.getAttribute('data-theme');
  try {
    var saved = JSON.parse(localStorage.getItem('chemia:state:v1') || '{}');
    var theme = saved && saved.settings && saved.settings.theme;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  } catch (e) { /* first run, or storage unavailable */ }
})();
`.trim();

const NOSCRIPT = `<noscript>
      <div style="padding:3rem;max-width:60ch;margin:0 auto">
        <h1>CHEMIA</h1>
        <p>Esta plataforma necesita JavaScript para ejecutar los motores de
          simulación científica. Actívalo para continuar.</p>
      </div>
    </noscript>`;

const body = `<title>CHEMIA</title>
<style>
${css}
</style>

<script>${prepaint}</script>

<a class="skip-link" href="#contenido">Saltar al contenido principal</a>
<div id="app">
    ${NOSCRIPT}
</div>

<script>
${loader}
</script>
<script>
${modules}
</script>
<script>
${boot}
</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/chemia.html'), body);

// The same page inside the skeleton the artefact host supplies, so that local
// verification exercises what the reader will actually load.
writeFileSync(join(root, 'dist/chemia-test.html'), `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
:root { color-scheme: light; }
body { margin: 0; font: 14px system-ui, sans-serif; background: #f7f7f5; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
</head>
<body>
${body}
</body>
</html>
`);

const kb = (s) => `${(s.length / 1024).toFixed(0)} kB`;
console.log(`estilos   ${kb(css)}`);
console.log(`modulos   ${kb(modules)}  (${(modules.match(/System\.register\(/g) || []).length} modulos)`);
console.log(`total     ${kb(body)}  → dist/chemia.html`);
