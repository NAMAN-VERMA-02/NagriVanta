// Evaluates category triage on labelled data. Uses Gemini if GEMINI_API_KEY is set, else the rules.
// Usage: npm run eval -- [--nyc-limit 200]
// Reports sample size, accuracy, per-class precision/recall and latency. No database needed.
import fs from 'node:fs';
import { CATEGORIES } from '../src/config/constants.js';
import { aiEnabled, triage } from '../src/services/ai.js';

const nycLimit = Number(process.argv[process.argv.indexOf('--nyc-limit') + 1]) || 200;

const NYC_MAP = {
  'Street Condition': 'road', 'Street Light Condition': 'streetlight', Sewer: 'drainage',
  'Dirty Condition': 'garbage', 'Illegal Dumping': 'garbage', 'Missed Collection': 'garbage', 'Water System': 'water',
};

function loadIndia() {
  const { items } = JSON.parse(fs.readFileSync(new URL('../../data/civic_labelled_india.json', import.meta.url), 'utf8'));
  // the generator repeats templates, so evaluate each distinct text once
  const seen = new Set();
  return items.filter((i) => !seen.has(i.title) && seen.add(i.title)).map((i) => ({ title: i.title, description: i.description, label: i.label.category }));
}

function loadNyc() {
  const lines = fs.readFileSync(new URL('../../data/nyc311_sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  const rows = lines.map((l) => l.split(',').map((s) => s.replace(/^"|"$/g, '')))
    .filter((r) => NYC_MAP[r[4]] && r[5])
    // only the descriptor is shown to the classifier; complaint_type is the label
    .map((r) => ({ title: r[5], description: r[5], label: NYC_MAP[r[4]] }));
  const step = Math.max(1, Math.floor(rows.length / nycLimit));
  return rows.filter((_, i) => i % step === 0).slice(0, nycLimit);
}

async function evaluate(name, rows) {
  const confusion = {};
  const latencies = [];
  let correct = 0;
  for (const r of rows) {
    const out = await triage(r.title, r.description);
    latencies.push(out.latencyMs);
    if (out.category === r.label) correct += 1;
    confusion[r.label] ??= {};
    confusion[r.label][out.category] = (confusion[r.label][out.category] || 0) + 1;
  }
  const perClass = CATEGORIES.map((c) => {
    const tp = confusion[c]?.[c] || 0;
    const predicted = Object.values(confusion).reduce((s, row) => s + (row[c] || 0), 0);
    const actual = Object.values(confusion[c] || {}).reduce((s, n) => s + n, 0);
    return { category: c, n: actual, precision: predicted ? +(tp / predicted).toFixed(2) : null, recall: actual ? +(tp / actual).toFixed(2) : null };
  }).filter((x) => x.n);
  const sorted = latencies.sort((a, b) => a - b);
  console.log(`\n=== ${name}: n=${rows.length}, engine=${aiEnabled() ? 'gemini' : 'rules'} ===`);
  console.log(`accuracy ${(100 * correct / rows.length).toFixed(1)}%  latency p50 ${sorted[Math.floor(sorted.length * 0.5)]}ms p95 ${sorted[Math.floor(sorted.length * 0.95)]}ms`);
  console.table(perClass);
}

await evaluate('India synthetic (distinct templates)', loadIndia());
await evaluate('NYC 311 descriptors (real)', loadNyc());
console.log('\nCaveats: the India set is small and synthetic; NYC descriptors are short and US-specific. Report these numbers with their n.');
