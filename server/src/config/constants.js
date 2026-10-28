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
export const ASSIGNABLE_FROM = ['submitted', 'under_review', 'needs_info', 'assigned', 'reopened'];
export const REOPENABLE_FROM = ['resolved', 'closed'];
export const REOPEN_WINDOW_DAYS = 30;

export const DEFAULT_SLA_HOURS = { low: 168, medium: 72, high: 24, critical: 8 };

// Multi-city configuration. Add a city by adding an entry here and seeding its departments.
export const CITIES = {
  Ghaziabad: {
    center: { lat: 28.6692, lng: 77.4538 },
    wards: {
      Indirapuram: { lat: 28.6460, lng: 77.3695 },
      Vaishali: { lat: 28.6448, lng: 77.3388 },
      'Raj Nagar Extension': { lat: 28.6956, lng: 77.4180 },
      'Kavi Nagar': { lat: 28.6729, lng: 77.4497 },
      Vasundhara: { lat: 28.6604, lng: 77.3647 },
    },
  },
  Noida: {
    center: { lat: 28.5355, lng: 77.3910 },
    wards: {
      'Sector 62 Noida': { lat: 28.6270, lng: 77.3725 },
      'Sector 18 Noida': { lat: 28.5708, lng: 77.3261 },
      'Sector 137 Noida': { lat: 28.5103, lng: 77.4085 },
    },
  },
};
export const CITY_NAMES = Object.keys(CITIES);
export const cityOfWard = (ward) => CITY_NAMES.find((c) => ward && CITIES[c].wards[ward]);

// Nearest city by straight-line distance; used when a report has no ward.
export function nearestCity(lat, lng) {
  let best = CITY_NAMES[0];
  let bestD = Infinity;
  for (const c of CITY_NAMES) {
    for (const w of Object.values(CITIES[c].wards)) {
      const d = (w.lat - lat) ** 2 + (w.lng - lng) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
  }
  return best;
}

export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const AUTO_ASSIGN_MIN_CONFIDENCE = 0.7;
export const DUPLICATE_RADIUS_M = 300;
export const DUPLICATE_WINDOW_DAYS = 30;
export const PUBLIC_MIN_GROUP = 5; // public stats hide groups smaller than this
