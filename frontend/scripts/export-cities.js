// Build-time metadata only. No profiles, calendars, prices or recommendations are exported.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const source = new URL('../../backend/data/contractors.csv', import.meta.url);
const target = new URL('../src/data/cities.json', import.meta.url);
const bytes = await readFile(source);
const rows = parse(bytes, { columns: true, bom: true, skip_empty_lines: true });
if (!rows.length || rows.some(row => !row.city?.trim())) throw new Error('CSV: отсутствует city');
const content = JSON.stringify({
  source: 'backend/data/contractors.csv',
  // Git may convert LF to CRLF on checkout. Fingerprint the same UTF-8 text
  // consistently across platforms, while still detecting content changes.
  sha256: createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex'),
  cities: [...new Set(rows.map(row => row.city.trim()))].sort(),
}, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const existing = (await readFile(target, 'utf8')).replace(/\r\n/g, '\n');
  if (existing !== content) throw new Error('Справочник городов устарел: npm run metadata:export');
  console.log('Справочник городов соответствует CSV (SHA-256).');
} else {
  await writeFile(target, content);
  console.log(`Справочник сохранён: ${fileURLToPath(target)}`);
}
