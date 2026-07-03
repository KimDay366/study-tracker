import { useEffect, useState } from 'react';
import { weeklyReviewRepo } from '@/lib/storage';
import { getLocalDateString } from '@/lib/calculator/timer';

/** 이번 주(로컬 기준) 일요일 날짜 문자열 */
function getThisWeekSunday(): string {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay()); // 0=일
  return getLocalDateString(sunday.getTime());
}

/**
 * 일요일이면서 이번 주 회고가 아직 저장되지 않은 경우 true.
 * 내비게이션의 "주간 회고" 항목에 작성 유도 배지를 노출하는 데 사용한다.
 */
export function useWeeklyReviewBadge(): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      const isSunday = new Date().getDay() === 0;
      if (!isSunday) {
        setShow(false);
        return;
      }
      const existing = weeklyReviewRepo.getByWeekStart(getThisWeekSunday());
      setShow(!existing);
    };
    evaluate();
    // 회고 저장 후 돌아왔을 때 배지가 사라지도록 포커스 시 재평가
    window.addEventListener('focus', evaluate);
    return () => window.removeEventListener('focus', evaluate);
  }, []);

  return show;
}
