export interface Category {
  id: string;
  name: string;
  colorVar: string; // '--cat-color-01' ~ '--cat-color-20'
  targetMinutes: number; // 정수, 1~1440
  targetPercent: number; // 소수 1자리, 0.1~100.0
}

export interface StudyLogic {
  id: string;
  name: string; // 최대 20자
  totalTargetMinutes: number; // 정수, 1~1440
  categories: Category[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface LogicSnapshot {
  name: string;
  totalTargetMinutes: number;
  categories: Pick<Category, 'id' | 'name' | 'colorVar' | 'targetMinutes' | 'targetPercent'>[];
}

export interface Session {
  id: string;
  categoryId: string;
  sessionStartTimestamp: number; // ms 정수
  sessionEndTimestamp: number;   // ms 정수
  durationMinutes: number;       // 정수, 최소 0
  isManuallyEdited: boolean;     // 기본값 false
  editedAt: string | null;       // ISO 8601 or null
  source: 'timer' | 'manual';   // 기본값 'timer'
}

export interface CategoryAchievement {
  categoryId: string;
  achievementPercent: number; // 소수 1자리
}

export interface AchievementCache {
  totalAchievementPercent: number;
  categoryAchievements: CategoryAchievement[];
  cachedAt: string; // ISO 8601
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  logicId: string;
  logicSnapshot: LogicSnapshot;
  sessions: Session[];
  achievementCache: AchievementCache | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  weekStartDate: string; // YYYY-MM-DD (일요일)
  keep: string;
  problem: string;
  try: string;
  pledge: string;
  usedBuiltinQuote: boolean;
  builtinQuoteIndex: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineDay {
  enabled: boolean;
  time: string | null; // HH:MM or null
  logicId: string | null;
}

export interface RoutineSetting {
  days: Record<string, RoutineDay>; // '0'~'6'
  updatedAt: string;
}

export interface AppSettings {
  autoStartOnCategorySelect: boolean;
  lastUsedLogicId: string | null;
  dataFormatVersion: string;
  firstLaunchDate: string | null;
  hasSeenOnboarding: boolean;
  updatedAt: string;
}
