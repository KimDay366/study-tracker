import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTodayStore } from '@/stores/todayStore';
import { useUIStore } from '@/stores/uiStore';
import { useLogics, useDeleteLogic } from '@/hooks/query/useLogics';
import { MAX_LOGICS } from '@/types/constants';
import type { StudyLogic } from '@/types';
import { Dialog } from '@/components/common/Dialog';
import styles from './LogicList.module.css';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export function LogicList() {
  const navigate = useNavigate();
  const selectedLogicId = useTodayStore(s => s.selectedLogicId);
  const showToast = useUIStore(s => s.showToast);

  const { data: logics = [], isLoading, isError } = useLogics();
  const deleteLogic = useDeleteLogic();

  const [deleteTarget, setDeleteTarget] = useState<StudyLogic | null>(null);

  const count = logics.length;
  const isFull = count >= MAX_LOGICS;

  function handleAddSlotClick() {
    if (isFull) {
      showToast('로직은 최대 5개까지 만들 수 있어요.', 'warning');
      return;
    }
    navigate('/logics/new');
  }

  function handleCardClick(logic: StudyLogic) {
    navigate(`/logics/${logic.id}`);
  }

  function handleDeleteClick(e: React.MouseEvent, logic: StudyLogic) {
    e.stopPropagation();
    setDeleteTarget(logic);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteLogic.mutateAsync(deleteTarget.id);
      showToast(`'${deleteTarget.name}' 로직을 삭제했어요.`, 'default');
    } catch {
      showToast('삭제 중 오류가 발생했어요.', 'danger');
    } finally {
      setDeleteTarget(null);
    }
  }

  const isCurrentlyUsed = (logic: StudyLogic) => logic.id === selectedLogicId;

  return (
    <>
      {/* 모바일/태블릿 앱바 */}
      <header className={styles.mobileAppBar}>
        <span className={styles.mobileAppBarTitle}>로직 관리</span>
        <span className={styles.mobileAppBarMeta}>{count} / {MAX_LOGICS}개</span>
      </header>

      {/* PC 전용 헤더 */}
      <div className={styles.pcHeader}>
        <h1 className={styles.pcHeaderTitle}>로직 관리</h1>
        <span className={styles.pcHeaderMeta}>{count} / {MAX_LOGICS}개</span>
      </div>

      <div className={styles.page}>
        {/* 안내 배너 */}
        <div className={styles.infoBanner}>
          <span>💡</span>
          <span>
            로직은 최대 <strong>{MAX_LOGICS}개</strong>까지 만들 수 있어요.
            카드를 탭하면 수정할 수 있어요.
          </span>
        </div>

        {/* 로딩 */}
        {isLoading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyDesc}>로직을 불러오는 중...</div>
          </div>
        )}

        {/* 에러 */}
        {isError && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>불러오기 실패</div>
            <div className={styles.emptyDesc}>서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.</div>
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && !isError && logics.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <div className={styles.emptyTitle}>아직 로직이 없어요</div>
            <div className={styles.emptyDesc}>
              첫 번째 공부 로직을 만들어 보세요!<br />
              로직에 카테고리와 목표 시간을 설정할 수 있어요.
            </div>
          </div>
        )}

        {/* 로직 그리드 */}
        <div className={styles.logicGrid}>
          {logics.map(logic => (
            <button
              key={logic.id}
              className={styles.logicCard}
              onClick={() => handleCardClick(logic)}
              aria-label={`${logic.name} 로직 수정`}
            >
              <div className={styles.logicCardHeader}>
                <div className={styles.logicCardName}>{logic.name}</div>
                {isCurrentlyUsed(logic) && (
                  <span className={styles.logicCardBadge}>현재 사용 중</span>
                )}
              </div>

              <div className={styles.logicCardMeta}>
                <div className={styles.logicCardMetaItem}>
                  <span>📂</span>
                  <span>카테고리 {logic.categories.length}개</span>
                </div>
                <div className={styles.logicCardMetaItem}>
                  <span>⏱</span>
                  <span>총 {formatMinutes(logic.totalTargetMinutes)}</span>
                </div>
              </div>

              <div className={styles.catChips}>
                {logic.categories.map(cat => (
                  <div
                    key={cat.id}
                    className={styles.catChip}
                    style={{
                      background: `color-mix(in srgb, var(${cat.colorVar}) 15%, var(--color-bg-surface))`,
                    }}
                  >
                    <div
                      className={styles.catChipDot}
                      style={{ background: `var(${cat.colorVar})` }}
                    />
                    <span>{cat.name} {cat.targetMinutes}분</span>
                  </div>
                ))}
              </div>

              <div className={styles.logicCardActions}>
                <span className={styles.logicCardHint}>탭하여 수정</span>
                <button
                  className={styles.btnDelete}
                  onClick={(e) => handleDeleteClick(e, logic)}
                  aria-label={`${logic.name} 삭제`}
                >
                  삭제
                </button>
              </div>
            </button>
          ))}

          {/* 로직 추가 슬롯 */}
          {!isLoading && !isError && (
            <button
              className={`${styles.logicAddSlot}${isFull ? ` ${styles.slotDisabled}` : ''}`}
              onClick={handleAddSlotClick}
              aria-label={isFull ? '로직 추가 불가 (최대 5개)' : '로직 추가'}
              aria-disabled={isFull}
            >
              <div className={styles.slotInner}>
                <div className={styles.slotIcon}>+</div>
                <div className={styles.slotLabel}>
                  {isFull ? '로직 추가 불가' : '로직 추가'}
                </div>
                <div className={styles.slotSub}>
                  {isFull ? '최대 5개 도달' : `슬롯 여유 ${MAX_LOGICS - count}개`}
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteTarget && (
        <Dialog
          icon="🗑️"
          title="로직을 삭제할까요?"
          description={`'${deleteTarget.name}' 로직을 삭제하면 이 로직의 설정이 사라져요. 기존 공부 기록은 유지돼요.${isCurrentlyUsed(deleteTarget) ? '\n\n현재 오늘의 공부에 사용 중인 로직이에요.' : ''}`}
          cancelLabel="취소"
          confirmLabel="삭제"
          confirmVariant="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}
