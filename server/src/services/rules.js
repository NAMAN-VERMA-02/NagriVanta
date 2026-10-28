// Deterministic, explainable rules. Used as the AI fallback and for the priority score.

const CATEGORY_KEYWORDS = {
  road: ['pothole', 'road', 'crack', 'speed breaker', 'footpath', 'pavement', 'asphalt', 'street repair', 'sadak', 'gaddha', 'सड़क', 'गड्ढा'],
  garbage: ['garbage', 'trash', 'waste', 'litter', 'dump', 'dumping', 'bin', 'kooda', 'kachra', 'safai', 'collection', 'dirty', 'कूड़ा', 'कचरा'],
  water: ['water supply', 'pipe', 'pipeline', 'leak', 'leakage', 'tap', 'water pressure', 'muddy water', 'paani', 'pani', 'पानी', 'hydrant', 'main break'],
  streetlight: ['streetlight', 'street light', 'street lamp', 'lamp', 'light pole', 'pole', 'bulb', 'flicker', 'batti', 'बत्ती'],
  drainage: ['drain', 'drainage', 'sewer', 'manhole', 'waterlogging', 'water logging', 'overflow', 'nali', 'naali', 'नाली', 'clog', 'choked'],
};

export function ruleCategory(text = '') {
  const t = text.toLowerCase();
  let best = { category: 'other', hits: [] };
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = words.filter((w) => t.includes(w));
    if (hits.length > best.hits.length) best = { category, hits };
  }
  return {
    category: best.category,
    confidence: best.hits.length ? Math.min(0.9, 0.4 + 0.15 * best.hits.length) : 0.2,
    reasons: best.hits.length ? [`Matched keywords: ${best.hits.slice(0, 4).join(', ')}`] : ['No category keywords matched'],
  };
}

const FACTORS = [
  { label: 'Safety risk (injury, shock, fall)', points: 30, words: ['accident', 'fell', 'fall', 'injur', 'danger', 'shock', 'wire', 'unsafe', 'open manhole', 'cover missing', 'skid', 'गिर', 'khatra', 'risk'] },
  { label: 'Blocked access or flooding', points: 20, words: ['blocked', 'flood', 'waterlogging', 'entering houses', 'burst', 'supply cut', 'no water', 'cannot pass'] },
  { label: 'Near sensitive place (school/hospital/market)', points: 15, words: ['school', 'hospital', 'clinic', 'market', 'temple', 'bus stop', 'metro', 'children'] },
  { label: 'Persisting for days', points: 10, words: ['days', 'week', 'month', 'din se', 'since'] },
  { label: 'Health hazard (smell, stagnant, dogs)', points: 10, words: ['smell', 'stagnant', 'mosquito', 'stray dogs', 'flies', 'health'] },
];
const CATEGORY_BASE = { drainage: 10, water: 10, road: 10, streetlight: 5, garbage: 5, other: 0 };

export function priorityFromScore(total) {
  if (total >= 60) return 'critical';
  if (total >= 40) return 'high';
  if (total >= 20) return 'medium';
  return 'low';
}

// Transparent score: every point is traceable to a listed factor.
export function scorePriority({ text = '', category = 'other', duplicateCount = 0 }) {
  const t = text.toLowerCase();
  const factors = [];
  if (CATEGORY_BASE[category]) factors.push({ label: `Category base (${category})`, points: CATEGORY_BASE[category] });
  for (const f of FACTORS) if (f.words.some((w) => t.includes(w))) factors.push({ label: f.label, points: f.points });
  if (duplicateCount) factors.push({ label: `${duplicateCount} similar nearby report(s)`, points: Math.min(15, duplicateCount * 5) });
  const total = factors.reduce((s, f) => s + f.points, 0);
  return { total, factors, priority: priorityFromScore(total) };
}

export function ruleSummary(title, description) {
  const first = description.split(/(?<=[.!?।])\s/)[0];
  return (first.length > 140 ? `${first.slice(0, 137)}...` : first) || title;
}
