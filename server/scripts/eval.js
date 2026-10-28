// Evaluates category triage on HELD-OUT data (never used by `npm run train`).
// Compares keyword rules, the trained Naive Bayes model, and Gemini when GEMINI_API_KEY works.
// Usage: npm run eval -- [--nyc-limit 300]
import { CATEGORIES } from '../src/config/constants.js';
import { aiEnabled, localTriage, triage } from '../src/services/ai.js';
import { ruleCategory } from '../src/services/rules.js';
import { loadIndia, loadNyc } from './train.js';

const nycLimit = Number(process.argv[process.argv.indexOf('--nyc-limit') + 1]) || 300;

function report(name, rows, predictFn) {
  const confusion = {};
  let correct = 0;
  for (const r of rows) {
    const got = predictFn(r);
    if (got === r.label) correct += 1;
    confusion[r.label] ??= {};
    confusion[r.label][got] = (confusion[r.label][got] || 0) + 1;
  }
  const perClass = CATEGORIES.map((c) => {
    const tp = confusion[c]?.[c] || 0;
    const predicted = Object.values(confusion).reduce((s, row) => s + (row[c] || 0), 0);
    const actual = Object.values(confusion[c] || {}).reduce((s, n) => s + n, 0);
    return { category: c, n: actual, precision: predicted ? +(tp / predicted).toFixed(2) : null, recall: actual ? +(tp / actual).toFixed(2) : null };
  }).filter((x) => x.n);
  console.log(`  ${name.padEnd(22)} accuracy ${(100 * correct / rows.length).toFixed(1)}%`);
  return perClass;
}

async function evaluate(title, rows) {
  console.log(`\n=== ${title}: n=${rows.length} (held out) ===`);
  report('keyword rules', rows, (r) => ruleCategory(r.text).category);
  const table = report('naive bayes + rules', rows, (r) => localTriage(r.text, '').category);
  if (aiEnabled()) {
    const preds = [];
    for (const r of rows.slice(0, 50)) preds.push({ ...r, got: (await triage(r.text, r.text)).category });
    report('gemini (first 50)', preds, (r) => r.got);
  }
  console.table(table);
}

const india = loadIndia().filter((d) => d.holdout);
const nycAll = loadNyc().filter((d) => d.holdout);
const step = Math.max(1, Math.floor(nycAll.length / nycLimit));
const nyc = nycAll.filter((_, i) => i % step === 0).slice(0, nycLimit);

await evaluate('India synthetic', india);
await evaluate('NYC 311 descriptors (real)', nyc);
console.log('\nCaveats: the India hold-out is tiny and synthetic; NYC descriptors are short and US-specific. Quote numbers with their n.');
