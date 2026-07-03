export const CAT_COLORS = [
  '--cat-color-01', '--cat-color-02', '--cat-color-03', '--cat-color-04',
  '--cat-color-05', '--cat-color-06', '--cat-color-07', '--cat-color-08',
  '--cat-color-09', '--cat-color-10', '--cat-color-11', '--cat-color-12',
  '--cat-color-13', '--cat-color-14', '--cat-color-15', '--cat-color-16',
  '--cat-color-17', '--cat-color-18', '--cat-color-19', '--cat-color-20',
] as const;

export type CatColor = typeof CAT_COLORS[number];

export const BREAKPOINTS = {
  mobile: 767,
  tablet: 1199,
} as const;

export const MAX_LOGICS = 5;
export const MAX_CATEGORIES = 10;
export const TARGET_MINUTES_MAX = 1440;
export const TARGET_MINUTES_MIN = 1;

export const STORAGE_KEYS = {
  LOGICS: 'st_logics',
  ROUTINE: 'st_routine',
  SETTINGS: 'st_settings',
  dailyRecord: (date: string) => `st_daily_${date}`,
  weeklyReview: (date: string) => `st_weekly_${date}`,
} as const;

export const DATA_FORMAT_VERSION = '1.0.0';
