import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Outbound integration hook: when WEBHOOK_URL is set, every case event is POSTed there as JSON,
 * signed with HMAC-SHA256 (header X-NagriVanta-Signature) so a partner system can trust it.
 * Failures are logged and never block the citizen-facing flow.
 */
export async function emitEvent(event, complaint, extra = {}) {
  if (!env.webhookUrl) return;
  const body = JSON.stringify({
    event,
    referenceId: complaint.referenceId,
    status: complaint.status,
    category: complaint.category,
    priority: complaint.priority,
    city: complaint.city,
    ward: complaint.ward,
    externalId: complaint.externalId,
    at: new Date().toISOString(),
    ...extra,
  });
  try {
    await fetch(env.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-NagriVanta-Signature': createHmac('sha256', env.webhookSecret).update(body).digest('hex') },
      body,
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error('webhook failed:', err.message);
  }
}
