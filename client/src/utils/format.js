export const CATEGORIES = [
  { value: 'road', label: 'Road / pothole', emoji: '🛣️' },
  { value: 'garbage', label: 'Garbage / waste', emoji: '🗑️' },
  { value: 'water', label: 'Water supply / leak', emoji: '🚰' },
  { value: 'streetlight', label: 'Streetlight', emoji: '💡' },
  { value: 'drainage', label: 'Drainage / sewer', emoji: '🌊' },
  { value: 'other', label: 'Other', emoji: '📍' },
];
export const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

export const STATUS = {
  submitted: { label: 'Submitted', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  under_review: { label: 'Under review', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200' },
  needs_info: { label: 'Needs info', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  assigned: { label: 'Assigned', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200' },
  in_progress: { label: 'In progress', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200' },
  blocked: { label: 'Blocked', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  reopened: { label: 'Reopened', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' },
  closed: { label: 'Closed', cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200' },
};
export const STATUS_KEYS = Object.keys(STATUS);

export const PRIORITY = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  critical: 'bg-red-600 text-white',
};

export const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');

export function timeLeft(due) {
  if (!due) return null;
  const ms = new Date(due) - Date.now();
  const h = Math.round(Math.abs(ms) / 36e5);
  const txt = h >= 48 ? `${Math.round(h / 24)} days` : `${h} h`;
  return { overdue: ms < 0, text: ms < 0 ? `Overdue by ${txt}` : `${txt} left` };
}

export const ACTION_LABEL = {
  created: 'Report submitted', status_change: 'Status changed', assigned: 'Assigned', reviewed: 'Reviewed by staff',
  note: 'Update', feedback: 'Citizen feedback', reopened: 'Reopened by citizen', escalated: 'SLA escalation', ai_analysis: 'AI triage',
};
