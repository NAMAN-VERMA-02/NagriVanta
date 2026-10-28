// Trains the Naive Bayes category classifier from the bundled datasets and writes src/ai/model.json.
// Run: npm run train   (then `npm run eval` to measure it on held-out data)
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { train } from '../src/services/classifier.js';

export const NYC_MAP = {
  'Street Condition': 'road', 'Street Light Condition': 'streetlight', Sewer: 'drainage',
  'Dirty Condition': 'garbage', 'Illegal Dumping': 'garbage', 'Missed Collection': 'garbage', 'Water System': 'water',
};

// Template index decides the split, so the same sentence never appears in both train and test.
export const isHoldout = (i) => i % 4 === 3;

export function loadIndia() {
  const { items } = JSON.parse(fs.readFileSync(new URL('../../data/civic_labelled_india.json', import.meta.url), 'utf8'));
  const byText = new Map();
  for (const it of items) byText.set(`${it.title}\n${it.description}`, it.label.category);
  return [...byText].map(([text, label], i) => ({ text, label, holdout: isHoldout(i) }));
}

export function loadNyc() {
  const lines = fs.readFileSync(new URL('../../data/nyc311_sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  return lines.map((l) => l.split(',').map((s) => s.replace(/^"|"$/g, '')))
    .filter((r) => NYC_MAP[r[4]] && r[5])
    // only the descriptor is the input; complaint_type is the label.
    // Split by distinct descriptor text so no test sentence was seen in training.
    .map((r) => ({ text: r[5], label: NYC_MAP[r[4]] }))
    .map((d, _, all) => {
      all.distinct ??= [...new Set(all.map((x) => x.text))];
      return { ...d, holdout: isHoldout(all.distinct.indexOf(d.text)) };
    });
}

// Short seed vocabulary per class so categories missing from the datasets (e.g. water) still have signal.
const SEED = {
  road: 'pothole road damaged road crack sadak gaddha सड़क गड्ढा speed breaker footpath broken',
  garbage: 'garbage trash waste dump litter kooda kachra कूड़ा कचरा overflowing bin not collected',
  water: 'water leakage pipe burst tap no water supply dirty water paani पानी leak pipeline',
  streetlight: 'street light not working lamp pole dark bulb batti बत्ती wire',
  drainage: 'drain blocked sewer overflow manhole waterlogging nali नाली choked',
  other: 'stray animals park bench noise encroachment tree fallen other',
};

export function buildDocs({ includeHoldout = false } = {}) {
  const india = loadIndia().filter((d) => includeHoldout || !d.holdout).map((d) => ({ ...d, weight: 3 }));
  // NYC has thousands of rows for few descriptors; collapse to one weighted doc per descriptor.
  const nyc = new Map();
  for (const d of loadNyc()) if (includeHoldout || !d.holdout) nyc.set(`${d.label}|${d.text}`, (nyc.get(`${d.label}|${d.text}`) || 0) + 1);
  const nycDocs = [...nyc].map(([k, n]) => ({ label: k.split('|')[0], text: k.split('|')[1], weight: Math.min(5, 1 + Math.log2(n)) }));
  const seedDocs = Object.entries(SEED).map(([label, text]) => ({ label, text, weight: 2 }));
  return [...india, ...nycDocs, ...seedDocs];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // The shipped model trains on the training split only, so `npm run eval` stays an honest held-out test.
  const model = train(buildDocs());
  fs.mkdirSync(new URL('../src/ai/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('../src/ai/model.json', import.meta.url), JSON.stringify(model));
  console.log(`Trained on ${model.docs} documents, vocabulary ${model.vocabSize}. Wrote src/ai/model.json`);
}
