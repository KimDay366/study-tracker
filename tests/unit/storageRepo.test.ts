import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudyLogicRepository, AppSettingsRepository } from '@/lib/storage/localStorageRepo';

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe('StudyLogicRepository', () => {
  const repo = new StudyLogicRepository();

  it('빈 스토리지 → getAll() 빈 배열 반환', () => {
    expect(repo.getAll()).toEqual([]);
  });

  it('저장 후 불러오기', () => {
    const logics = [{ id: '1', name: '테스트', totalTargetMinutes: 60, categories: [], createdAt: '', updatedAt: '' }];
    repo.save(logics as any);
    expect(repo.getAll()).toEqual(logics);
  });

  it('JSON parse 실패 시 빈 배열 폴백', () => {
    localStorageMock.getItem.mockReturnValueOnce('invalid-json{{{');
    expect(repo.getAll()).toEqual([]);
  });

  it('QuotaExceededError 시 QUOTA_EXCEEDED 에러 throw', () => {
    const error = new DOMException('quota exceeded', 'QuotaExceededError');
    localStorageMock.setItem.mockImplementationOnce(() => { throw error; });
    expect(() => repo.save([])).toThrow('QUOTA_EXCEEDED');
  });

  it('SecurityError 시 SECURITY_ERROR 에러 throw', () => {
    const error = new DOMException('security error', 'SecurityError');
    localStorageMock.setItem.mockImplementationOnce(() => { throw error; });
    expect(() => repo.save([])).toThrow('SECURITY_ERROR');
  });
});

describe('AppSettingsRepository', () => {
  const repo = new AppSettingsRepository();

  it('저장된 값 없으면 기본값 반환', () => {
    const settings = repo.get();
    expect(settings.autoStartOnCategorySelect).toBe(false);
    expect(settings.hasSeenOnboarding).toBe(false);
    expect(settings.dataFormatVersion).toBe('1.0.0');
    expect(settings.lastUsedLogicId).toBeNull();
  });
});
