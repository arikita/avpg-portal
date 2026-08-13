
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const SRC = __dirname + '/src/app/content';
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.ts'));
(async () => {
  const out = {};
  for (const f of files) {
    const r = await esbuild.build({
      entryPoints: [path.join(SRC, f)],
      bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent',
    });
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', r.outputFiles[0].text)(mod, mod.exports, require);
    out[f.replace('.content.ts', '').replace('.ts', '')] = mod.exports;
  }
  fs.writeFileSync('/tmp/content-dump.json', JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out))
    console.log('  ' + k.padEnd(13), Object.keys(v).join(', ').slice(0, 68));
})().catch(e => { console.error('LOI:', e.message); process.exit(1); });
