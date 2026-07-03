import type {
  StudyLogic, DailyRecord, Session, WeeklyReview, RoutineSetting, AppSettings,
  CategoryAchievement, AchievementCache,
} from '@/types';
import { STORAGE_KEYS, DATA_FORMAT_VERSION } from '@/types';
import type {
  IStudyLogicRepository,
  IDailyRecordRepository,
  IWeeklyReviewRepository,
  IRoutineSettingRepository,
  IAppSettingsRepository,
} from './types';

// 손상된(JSON 파싱 실패) 데이터 감지 플래그.
// readItem은 초기 렌더 중에도 호출되므로 콜백 대신 플래그로 모아두고,
// UI가 마운트 후 consumeStorageCorruption()으로 1회 소비해 안내 토스트를 띄운다.
let corruptionDetected = false;

/** 손상 감지 여부를 읽고 플래그를 초기화한다. */
export function consumeStorageCorruption(): boolean {
  const detected = corruptionDetected;
  corruptionDetected = false;
  return detected;
}

function readItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[storage] Failed to parse key "${key}"`, e);
    corruptionDetected = true;
    return null;
  }
}

function writeItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      throw new Error('QUOTA_EXCEEDED');
    }
    if (e instanceof DOMException && e.name === 'SecurityError') {
      throw new Error('SECURITY_ERROR');
    }
    throw e;
  }
}

export class StudyLogicRepository implements IStudyLogicRepository {
  getAll(): StudyLogic[] {
    return readItem<StudyLogic[]>(STORAGE_KEYS.LOGICS) ?? [];
  }

  getById(id: string): StudyLogic | null {
    return this.getAll().find(l => l.id === id) ?? null;
  }

  save(logics: StudyLogic[]): void {
    writeItem(STORAGE_KEYS.LOGICS, logics);
  }
}

export class DailyRecordRepository implements IDailyRecordRepository {
  getByDate(date: string): DailyRecord | null {
    return readItem<DailyRecord>(STORAGE_KEYS.dailyRecord(date));
  }

  /**
   * 해당 월의 기록 있는 날짜 목록을 반환 (YYYY-MM-DD 배열)
   * localStorage 키를 스캔하므로 월별 날짜 루프를 피함
   */
  getMonthlyDates(year: number, month: number): string[] {
    const prefix = `st_daily_${year}-${String(month).padStart(2, '0')}-`;
    const dates: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const date = key.replace('st_daily_', '');
        dates.push(date);
      }
    }
    return dates.sort();
  }

  /**
   * 해당 월의 DailyRecord 전체를 반환 (date → DailyRecord 맵)
   */
  getMonthlyRecords(year: number, month: number): Map<string, DailyRecord> {
    const dates = this.getMonthlyDates(year, month);
    const map = new Map<string, DailyRecord>();
    for (const date of dates) {
      const record = this.getByDate(date);
      if (record) map.set(date, record);
    }
    return map;
  }

  save(record: DailyRecord): void {
    writeItem(STORAGE_KEYS.dailyRecord(record.date), record);
  }

  updateSession(date: string, sessionId: string, updated: Session): void {
    const record = this.getByDate(date);
    if (!record) return;
    const idx = record.sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    const patched: Session = {
      ...updated,
      isManuallyEdited: true,
      editedAt: new Date().toISOString(),
    };
    const sessions = [...record.sessions];
    sessions[idx] = patched;
    this.saveSessionAndUpdateCache({ ...record, sessions });
  }

  deleteSession(date: string, sessionId: string): void {
    const record = this.getByDate(date);
    if (!record) return;
    const sessions = record.sessions.filter(s => s.id !== sessionId);
    if (sessions.length === record.sessions.length) return;
    this.saveSessionAndUpdateCache({ ...record, sessions });
  }

  saveSessionAndUpdateCache(record: DailyRecord): void {
    // achievementCache를 재계산 후 원자적으로 저장
    const totalMinutes = record.sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const targetMinutes = record.logicSnapshot.totalTargetMinutes;
    const totalAchievementPercent = targetMinutes > 0
      ? Math.round((totalMinutes / targetMinutes) * 1000) / 10
      : 0;

    const categoryMinutes: Record<string, number> = {};
    for (const s of record.sessions) {
      categoryMinutes[s.categoryId] = (categoryMinutes[s.categoryId] ?? 0) + s.durationMinutes;
    }

    const categoryAchievements: CategoryAchievement[] = record.logicSnapshot.categories.map(cat => {
      const actual = categoryMinutes[cat.id] ?? 0;
      const achievementPercent = cat.targetMinutes > 0
        ? Math.round((actual / cat.targetMinutes) * 1000) / 10
        : 0;
      return { categoryId: cat.id, achievementPercent };
    });

    const cache: AchievementCache = {
      totalAchievementPercent,
      categoryAchievements,
      cachedAt: new Date().toISOString(),
    };

    const updated: DailyRecord = {
      ...record,
      achievementCache: cache,
      updatedAt: new Date().toISOString(),
    };

    writeItem(STORAGE_KEYS.dailyRecord(record.date), updated);
  }
}

export class WeeklyReviewRepository implements IWeeklyReviewRepository {
  getByWeekStart(weekStartDate: string): WeeklyReview | null {
    return readItem<WeeklyReview>(STORAGE_KEYS.weeklyReview(weekStartDate));
  }

  save(review: WeeklyReview): void {
    writeItem(STORAGE_KEYS.weeklyReview(review.weekStartDate), review);
  }
}

export class RoutineSettingRepository implements IRoutineSettingRepository {
  get(): RoutineSetting | null {
    return readItem<RoutineSetting>(STORAGE_KEYS.ROUTINE);
  }

  save(setting: RoutineSetting): void {
    writeItem(STORAGE_KEYS.ROUTINE, setting);
  }
}

export class AppSettingsRepository implements IAppSettingsRepository {
  get(): AppSettings {
    const stored = readItem<AppSettings>(STORAGE_KEYS.SETTINGS);
    if (stored) return stored;
    return {
      autoStartOnCategorySelect: false,
      lastUsedLogicId: null,
      dataFormatVersion: DATA_FORMAT_VERSION,
      firstLaunchDate: null,
      hasSeenOnboarding: false,
      updatedAt: new Date().toISOString(),
    };
  }

  save(settings: AppSettings): void {
    writeItem(STORAGE_KEYS.SETTINGS, settings);
  }
}
