// Multinomial Naive Bayes over word unigrams/bigrams and character 3-grams.
// Character n-grams make it robust to Hindi (Devanagari), Hinglish spellings and typos.
// Trained offline by scripts/train.js into src/ai/model.json; runs in-process with no external service.
import fs from 'node:fs';

export function features(text = '') {
  const t = text.toLowerCase().normalize('NFC');
  const words = t.replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);
  const f = [...words];
  for (let i = 0; i < words.length - 1; i += 1) f.push(`${words[i]}_${words[i + 1]}`);
  for (const w of words) {
    const padded = `#${w}#`;
    const chars = [...padded];
    for (let i = 0; i + 3 <= chars.length; i += 1) f.push(`c:${chars.slice(i, i + 3).join('')}`);
  }
  return f;
}

export function train(docs, alpha = 0.5) {
  const classCounts = {};
  const featCounts = {};
  const totals = {};
  const vocab = new Set();
  for (const { text, label, weight = 1 } of docs) {
    classCounts[label] = (classCounts[label] || 0) + weight;
    featCounts[label] ??= {};
    for (const f of features(text)) {
      featCounts[label][f] = (featCounts[label][f] || 0) + weight;
      totals[label] = (totals[label] || 0) + weight;
      vocab.add(f);
    }
  }
  return { alpha, classCounts, featCounts, totals, vocabSize: vocab.size, trainedAt: new Date().toISOString(), docs: docs.length };
}

// Returns classes sorted by posterior probability (softmax over log-likelihoods).
export function predict(model, text) {
  const labels = Object.keys(model.classCounts);
  // Features no class has seen carry no evidence, but would favour the smallest class through smoothing.
  const feats = features(text).filter((f) => labels.some((l) => model.featCounts[l][f]));
  const nDocs = Object.values(model.classCounts).reduce((s, n) => s + n, 0);
  // Overlapping n-grams are far from independent, so raw NB is wildly overconfident.
  // Dividing the evidence by a temperature that grows with the feature count calibrates it.
  const temperature = Math.max(1, feats.length / 8);
  const scores = labels.map((label) => {
    const denom = model.totals[label] + model.alpha * model.vocabSize;
    let ll = 0;
    for (const f of feats) ll += Math.log(((model.featCounts[label][f] || 0) + model.alpha) / denom);
    return { label, s: Math.log(model.classCounts[label] / nDocs) + ll / temperature };
  });
  const max = Math.max(...scores.map((x) => x.s));
  const exp = scores.map((x) => ({ label: x.label, p: Math.exp(x.s - max) }));
  const z = exp.reduce((s, x) => s + x.p, 0);
  return exp.map((x) => ({ label: x.label, p: x.p / z })).sort((a, b) => b.p - a.p);
}

let cached;
export function loadModel() {
  if (cached !== undefined) return cached;
  try {
    cached = JSON.parse(fs.readFileSync(new URL('../ai/model.json', import.meta.url), 'utf8'));
  } catch {
    cached = null; // no trained model yet: callers fall back to keyword rules
  }
  return cached;
}
