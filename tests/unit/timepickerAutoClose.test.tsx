/**
 * Timepicker 개선 회귀 테스트 (2026-07-07 메인/루틴 UI 개선)
 * - 분 단위가 5분 → 1분(00~59) 세분화되었는지
 * - 시/분을 모두 선택 완료하면 드롭다운이 자동으로 닫히는지(하나만 고르면 안 닫힘)
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timepicker } from '@/components/common/Timepicker';

// jsdom엔 scrollIntoView 구현이 없다 — Timepicker가 선택 항목으로 스크롤을 시도하므로 폴리필 필요.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

/** 헤더("시"/"분") 텍스트의 부모가 곧 그 컬럼 div — data-val로 옵션을 스코프 안에서 찾는다. */
function getColumn(headerText: '시' | '분'): HTMLElement {
  return screen.getByText(headerText).parentElement as HTMLElement;
}

function openPicker() {
  fireEvent.click(screen.getByRole('combobox'));
}

describe('Timepicker — 1분 단위 + 자동 닫힘', () => {
  it('분 컬럼이 1분 단위(00~59, 60개)로 표시된다(기존 5분 단위 아님)', () => {
    render(<Timepicker value="08:30" disabled={false} onChange={vi.fn()} />);
    openPicker();

    const minCol = getColumn('분');
    // 기존 5분 단위 목록에는 없던 값들이 이제는 선택 가능해야 한다.
    expect(minCol.querySelector('[data-val="01"]')).not.toBeNull();
    expect(minCol.querySelector('[data-val="07"]')).not.toBeNull();
    expect(minCol.querySelector('[data-val="23"]')).not.toBeNull();
    expect(minCol.querySelector('[data-val="59"]')).not.toBeNull();
    // 60개 전부 렌더링되는지 개수로도 확인
    expect(minCol.querySelectorAll('[data-val]')).toHaveLength(60);
  });

  it('시/분을 하나만 고르면 드롭다운이 닫히지 않는다', () => {
    render(<Timepicker value="08:30" disabled={false} onChange={vi.fn()} />);
    openPicker();

    const hourCol = getColumn('시');
    fireEvent.click(hourCol.querySelector('[data-val="10"]')!);

    // 아직 분을 고르지 않았으므로 드롭다운(헤더 "분")이 계속 보여야 한다.
    expect(screen.queryByText('분')).not.toBeNull();
  });

  it('시/분을 모두 선택 완료하면 드롭다운이 자동으로 닫힌다', () => {
    const onChange = vi.fn();
    render(<Timepicker value="08:30" disabled={false} onChange={onChange} />);
    openPicker();

    const hourCol = getColumn('시');
    fireEvent.click(hourCol.querySelector('[data-val="10"]')!);

    // 재조회 필요 — 리렌더 후에도 같은 DOM 유지되지만 안전하게 다시 찾는다.
    const minCol = getColumn('분');
    fireEvent.click(minCol.querySelector('[data-val="07"]')!);

    expect(onChange).toHaveBeenLastCalledWith('10:07');
    // 시/분을 모두 골랐으므로 드롭다운이 닫혀 컬럼 헤더가 더 이상 보이지 않아야 한다.
    expect(screen.queryByText('시')).toBeNull();
    expect(screen.queryByText('분')).toBeNull();
  });

  it('닫혀 있다가 다시 열면 이전 선택 완료 상태가 초기화된다(다시 하나만 고르면 안 닫힘)', () => {
    render(<Timepicker value="08:30" disabled={false} onChange={vi.fn()} />);
    openPicker();
    fireEvent.click(getColumn('시').querySelector('[data-val="09"]')!);
    fireEvent.click(getColumn('분').querySelector('[data-val="15"]')!);
    expect(screen.queryByText('시')).toBeNull(); // 자동 닫힘 확인

    // 다시 열기
    openPicker();
    expect(screen.queryByText('시')).not.toBeNull();
    fireEvent.click(getColumn('분').querySelector('[data-val="20"]')!);
    // 이번엔 분만 골랐으므로 아직 열려 있어야 한다(시는 새로 고르지 않음).
    expect(screen.queryByText('시')).not.toBeNull();
  });
});
