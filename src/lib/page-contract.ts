export type PageContract = {
  title: string;
  eyebrow: string;
  api: string[];
};

export const PAGE_CONTRACTS: Record<string, PageContract> = {
  '/home': { title: 'Health Overview', eyebrow: 'HEALTH · DAILY STATUS', api: ['/api/health/overview', '/api/stats/today', '/api/water/today', '/api/checkin/today'] },
  '/scan': { title: 'Food Scan', eyebrow: 'SCAN · VISION ANALYSIS', api: ['/api/scan/vision', '/api/scan/calc', '/api/scan/save'] },
  '/diary': { title: 'Nutrition Diary', eyebrow: 'DIARY · MEAL LOG', api: ['/api/diary'] },
  '/mood': { title: 'Mood Check-in', eyebrow: 'MOOD · DAILY CHECK-IN', api: ['/api/mood/list', '/api/mood/recommend', '/api/mood/log'] },
  '/pedometer': { title: 'Activity Steps', eyebrow: 'ACTIVITY · STEPS', api: ['/api/pedometer'] },
  '/workout': { title: 'Training Load', eyebrow: 'ACTIVITY · WORKOUT', api: ['/api/workout'] },
  '/music': { title: 'Recovery Audio', eyebrow: 'MUSIC · SESSION', api: ['/api/music', '/api/music/session'] },
  '/stats': { title: 'Health Statistics', eyebrow: 'STATS · WEEKLY METRICS', api: ['/api/stats/today', '/api/stats/weekly', '/api/stats/week-summary'] },
  '/assistant': { title: 'WK Health Assistant', eyebrow: 'INTELLIGENCE · ASSISTANT', api: ['/api/assistant', '/api/assistant/history'] },
  '/nlp': { title: 'Nutrition Language Analysis', eyebrow: 'INTELLIGENCE · NLP', api: ['/api/nlp/analyze'] },
  '/device-connect': { title: 'Device Sync', eyebrow: 'DEVICES · CONNECTION', api: ['/api/devices'] },
  '/sound-control': { title: 'Audio Environment', eyebrow: 'SOUND · SESSION CONTROL', api: ['/api/sound'] },
  '/budget': { title: 'Nutrition Budget', eyebrow: 'NUTRITION · BUDGET PLAN', api: ['/api/budget/plan'] },
  '/gallery': { title: 'Health Media Library', eyebrow: 'MEDIA · IMAGE & VIDEO', api: ['/api/gallery', '/api/gallery/upload'] },
  '/friends': { title: 'Health Social', eyebrow: 'SOCIAL · FRIENDS', api: ['/api/friends', '/api/friends/add', '/api/friends/location/status', '/api/friends/location/share'] },
  '/export': { title: 'Health Data Export', eyebrow: 'DATA · EXPORT', api: ['/api/export', '/api/export/history'] },
  '/profile': { title: 'Account Profile', eyebrow: 'ACCOUNT · PROFILE', api: ['/api/auth/me'] },
  '/notifications': { title: 'Health Alerts', eyebrow: 'ACCOUNT · NOTIFICATIONS', api: ['/api/notifications/settings'] },
  '/vision': { title: 'Health Vision', eyebrow: 'VISION · PRESENTATION', api: ['/api/health/overview', '/api/stats/today', '/api/diary'] },
  '/auth': { title: 'Account Access', eyebrow: 'ACCOUNT · AUTHENTICATION', api: ['/api/auth/login', '/api/auth/register', '/api/auth/me'] },
};

export function getPageContract(pathname: string): PageContract | null {
  return PAGE_CONTRACTS[pathname] ?? null;
}
