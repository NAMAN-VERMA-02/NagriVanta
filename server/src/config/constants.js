export const ROLES = ['citizen', 'officer', 'admin'];
export const CATEGORIES = ['road', 'garbage', 'water', 'streetlight', 'drainage', 'other'];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const STATUSES = [
  'submitted', 'under_review', 'needs_info', 'assigned', 'in_progress',
  'blocked', 'resolved', 'reopened', 'rejected', 'closed',
];
export const ACTIVE_STATUSES = ['submitted', 'under_review', 'needs_info', 'assigned', 'in_progress', 'blocked', 'reopened'];

// from-status -> { to-status: roles allowed }. Assignment goes through /assign, reopen through /reopen.
export const TRANSITIONS = {
  submitted: { under_review: ['admin'], rejected: ['admin'] },
  under_review: { needs_info: ['admin'], rejected: ['admin'] },
  needs_info: { under_review: ['admin'], rejected: ['admin'] },
  assigned: { in_progress: ['officer', 'admin'], under_review: ['admin'] },
  in_progress: { resolved: ['officer', 'admin'], blocked: ['officer', 'admin'], under_review: ['admin'] },
  blocked: { in_progress: ['officer', 'admin'], under_review: ['admin'] },
  resolved: { closed: ['admin'] },
  reopened: { under_review: ['admin'], in_progress: ['officer', 'admin'] },
  rejected: { under_review: ['admin'] },
  closed: {},
};
export const ASSIGNABLE_FROM = ['under_review', 'needs_info', 'assigned', 'reopened'];
export const REOPENABLE_FROM = ['resolved', 'closed'];
export const REOPEN_WINDOW_DAYS = 30;

export const DEFAULT_SLA_HOURS = { low: 168, medium: 72, high: 24, critical: 8 };
export const DUPLICATE_RADIUS_M = 300;
export const DUPLICATE_WINDOW_DAYS = 30;
export const PUBLIC_MIN_GROUP = 5; // public stats hide groups smaller than this
