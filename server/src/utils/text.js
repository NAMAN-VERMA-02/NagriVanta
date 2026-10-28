const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'near', 'this', 'that', 'it', 'be', 'has', 'have', 'was', 'with', 'from', 'by', 'very', 'please', 'hai', 'ka', 'ki', 'ke', 'me', 'se', 'ko', 'aur', 'है', 'का', 'की', 'के', 'में', 'से', 'को', 'और']);

export function tokens(text = '') {
  return new Set(
    text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

// Jaccard similarity of word sets, 0..1
export function textSimilarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function haversineM([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ~110 m precision for public views
export const roundCoord = (n) => Math.round(n * 1000) / 1000;
