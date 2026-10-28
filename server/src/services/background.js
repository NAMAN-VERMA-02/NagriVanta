import { waitUntil } from '@vercel/functions';

/**
 * Runs slow follow-up work (Gemini refinement) after the response is sent.
 * On Vercel, waitUntil keeps the function alive until the promise settles (up to maxDuration);
 * on a normal Node server the promise simply keeps running. Errors are logged, never thrown.
 */
export function background(promise) {
  const safe = Promise.resolve(promise).catch((err) => console.error('background task failed:', err.message));
  try {
    waitUntil(safe);
  } catch {
    // not on Vercel: nothing to extend
  }
  return safe;
}
