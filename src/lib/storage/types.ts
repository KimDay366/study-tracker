import type { StudyLogic, DailyRecord, Session, WeeklyReview, RoutineSetting, AppSettings } from '@/types';

export interface IStudyLogicRepository {
  getAll(): StudyLogic[];
  getById(id: string): StudyLogic | null;
  save(logics: StudyLogic[]): void;
}

export interface IDailyRecordRepository {
  getByDate(date: string): DailyRecord | null;
  getMonthlyDates(year: number, month: number): string[];
  getMonthlyRecords(year: number, month: number): Map<string, DailyRecord>;
  save(record: DailyRecord): void;
  saveSessionAndUpdateCache(record: DailyRecord): void;
  updateSession(date: string, sessionId: string, updated: Session): void;
  deleteSession(date: string, sessionId: string): void;
}

export interface IWeeklyReviewRepository {
  getByWeekStart(weekStartDate: string): WeeklyReview | null;
  save(review: WeeklyReview): void;
}

export interface IRoutineSettingRepository {
  get(): RoutineSetting | null;
  save(setting: RoutineSetting): void;
}

export interface IAppSettingsRepository {
  get(): AppSettings;
  save(settings: AppSettings): void;
}
