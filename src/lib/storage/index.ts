export {
  StudyLogicRepository,
  DailyRecordRepository,
  WeeklyReviewRepository,
  RoutineSettingRepository,
  AppSettingsRepository,
  consumeStorageCorruption,
} from './localStorageRepo';

export type {
  IStudyLogicRepository,
  IDailyRecordRepository,
  IWeeklyReviewRepository,
  IRoutineSettingRepository,
  IAppSettingsRepository,
} from './types';

import {
  StudyLogicRepository,
  DailyRecordRepository,
  WeeklyReviewRepository,
  RoutineSettingRepository,
  AppSettingsRepository,
} from './localStorageRepo';

export const studyLogicRepo = new StudyLogicRepository();
export const dailyRecordRepo = new DailyRecordRepository();
export const weeklyReviewRepo = new WeeklyReviewRepository();
export const routineSettingRepo = new RoutineSettingRepository();
export const appSettingsRepo = new AppSettingsRepository();
