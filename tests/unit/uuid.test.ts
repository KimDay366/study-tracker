import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateId } from '@/lib/uuid';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateId', () => {
  it('반환값이 UUID v4 형식이어야 한다', () => {
    const id = generateId();
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('여러 번 호출 시 고유한 값을 반환해야 한다', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('crypto.randomUUID가 없는 환경에서 getRandomValues 폴백이 동작해야 한다', () => {
    vi.spyOn(crypto, 'randomUUID' as keyof Crypto).mockImplementation(undefined as any);

    const id = generateId();
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('getRandomValues 폴백도 고유한 값을 반환해야 한다', () => {
    vi.spyOn(crypto, 'randomUUID' as keyof Crypto).mockImplementation(undefined as any);

    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});
