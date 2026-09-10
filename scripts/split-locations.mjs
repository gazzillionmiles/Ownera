/**
 * Splits the monolithic countries+states+cities.json (~45MB) into one slim
 * file per country under data/locations/<iso2>.json, plus a tiny
 * data/locations/_index.json for the country list.
 *
 * Why: lib/locations/server.ts previously loaded and JSON.parse'd the full
 * 45MB world file on first request of every serverless instance (blocking
 * the event loop for a noticeable chunk of a second or more), even though
 * ~99% of traffic only ever needs India's ~460KB slice.
 *
 * Run with: node scripts/split-locations.mjs
 * Re-run whenever countries+states+cities.json is updated.
 */
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(import.meta.dirname, '..');
const srcPath = path.join(projectRoot, 'countries+states+cities.json');
const outDir = path.join(projectRoot, 'data', 'locations');

fs.mkdirSync(outDir, { recursive: true });

console.log('[split-locations] reading', srcPath);
const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

const index = [];

for (const c of raw) {
  const slim = {
    name: c.name,
    iso2: c.iso2,
    states: (c.states || []).map((s) => ({
      name: s.name,
      state_code: s.state_code || '',
      cities: (s.cities || []).map((ci) => (typeof ci === 'string' ? ci : ci.name)).filter(Boolean),
    })),
  };

  const fileName = `${c.iso2.toLowerCase()}.json`;
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(slim));

  index.push({
    name: c.name,
    iso2: c.iso2,
    states_count: slim.states.length,
  });
}

fs.writeFileSync(path.join(outDir, '_index.json'), JSON.stringify(index));

console.log(`[split-locations] wrote ${index.length} country files + _index.json to ${outDir}`);
