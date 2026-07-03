import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useLogics, useCreateLogic, useUpdateLogic } from '@/hooks/query/useLogics';
import { usePatchSettings } from '@/hooks/query/useSettings';
import { generateId } from '@/lib/uuid';
import {
  calcFromCategoryMinutes,
  calcFromTotalMinutes,
  isPercentSumValid,
} from '@/lib/calculator/biDirectional';
import { CAT_COLORS, MAX_CATEGORIES, TARGET_MINUTES_MAX } from '@/types/constants';
import type { Category } from '@/types';
import { Modal } from '@/components/common/Modal';
import { Dialog } from '@/components/common/Dialog';
import styles from './LogicEdit.module.css';

type Direction = 1 | 2;

interface CatDraft {
  id: string;
  name: string;
  colorVar: string;
  hours: number;
  minutes: number;
  percent: number;
}

function minutesToHoursAndMinutes(total: number): { hours: number; minutes: number } {
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

function hoursMinutesToTotal(hours: number, minutes: number): number {
  return Math.min(hours * 60 + minutes, TARGET_MINUTES_MAX);
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function makeDraftFromCategory(cat: Category): CatDraft {
  const { hours, minutes } = minutesToHoursAndMinutes(cat.targetMinutes);
  return {
    id: cat.id,
    name: cat.name,
    colorVar: cat.colorVar,
    hours,
    minutes,
    percent: cat.targetPercent,
  };
}

function newDraftCategory(colorVar: string = CAT_COLORS[0]): CatDraft {
  return {
    id: generateId(),
    name: '',
    colorVar,
    hours: 0,
    minutes: 0,
    percent: 0,
  };
}

export function LogicEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const showToast = useUIStore(s => s.showToast);

  const { data: logics = [] } = useLogics();
  const createLogic = useCreateLogic();
  const updateLogic = useUpdateLogic();
  const patchSettings = usePatchSettings();

  // 수정 모드: 이미 캐시에 있는 로직 데이터 활용
  const existingLogic = useMemo(
    () => (isNew ? null : logics.find(l => l.id === id) ?? null),
    [id, isNew, logics],
  );

  // --- 상태 ---
  const [logicName, setLogicName] = useState(existingLogic?.name ?? '');
  const [direction, setDirection] = useState<Direction>(1);

  const initTotal = existingLogic
    ? minutesToHoursAndMinutes(existingLogic.totalTargetMinutes)
    : { hours: 0, minutes: 0 };
  const [totalHours, setTotalHours] = useState(initTotal.hours);
  const [totalMins, setTotalMins] = useState(initTotal.minutes);

  const [cats, setCats] = useState<CatDraft[]>(() => {
    if (existingLogic && existingLogic.categories.length > 0) {
      return existingLogic.categories.map(makeDraftFromCategory);
    }
    return [newDraftCategory()];
  });

  const [colorModalForIdx, setColorModalForIdx] = useState<number | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // ---- 계산 ----
  const totalMinutes = hoursMinutesToTotal(totalHours, totalMins);
  const dir1Minutes = cats.map(c => hoursMinutesToTotal(c.hours, c.minutes));
  const { totalMinutes: dir1Total, percents: dir1Percents } = useMemo(
    () => calcFromCategoryMinutes(dir1Minutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(dir1Minutes)],
  );

  const dir2Percents = cats.map(c => c.percent);
  const dir2Minutes = useMemo(
    () => totalMinutes > 0 ? calcFromTotalMinutes(totalMinutes, dir2Percents) : cats.map(() => 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totalMinutes, JSON.stringify(dir2Percents)],
  );
  const dir2PercentSum = dir2Percents.reduce((a, b) => a + b, 0);
  const dir2Valid = isPercentSumValid(dir2Percents);

  // ---- 유효성 ----
  const nameError = logicName.trim().length === 0 ? '로직명을 입력해 주세요.' : null;
  const catNames = cats.map(c => c.name.trim());
  const dupSet = new Set<string>();
  const dupErrors: (string | null)[] = catNames.map((n, i) => {
    if (!n) return '카테고리 이름을 입력해 주세요.';
    if (catNames.indexOf(n) !== i) return '같은 이름의 카테고리가 있어요.';
    if (dupSet.has(n)) return '같은 이름의 카테고리가 있어요.';
    dupSet.add(n);
    return null;
  });

  const dir1TimeErrors: (string | null)[] = direction === 1
    ? cats.map(c => hoursMinutesToTotal(c.hours, c.minutes) < 1 ? '목표 시간은 1분 이상이어야 해요.' : null)
    : cats.map(() => null);

  const canSave =
    !nameError &&
    cats.length > 0 &&
    dupErrors.every(e => e === null) &&
    (direction === 1
      ? dir1TimeErrors.every(e => e === null) && dir1Total > 0
      : dir2Valid && totalMinutes > 0);

  const isSaving = createLogic.isPending || updateLogic.isPending;

  // ---- 핸들러 ----
  const updateCat = useCallback((idx: number, patch: Partial<CatDraft>) => {
    setCats(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }, []);

  function handleAddCat() {
    if (cats.length >= MAX_CATEGORIES) {
      showToast('카테고리는 최대 10개까지 추가할 수 있어요.', 'warning');
      return;
    }
    const usedColors = new Set(cats.map(c => c.colorVar));
    const nextColor = CAT_COLORS.find(c => !usedColors.has(c)) ?? CAT_COLORS[cats.length % CAT_COLORS.length];
    setCats(prev => [...prev, newDraftCategory(nextColor)]);
  }

  function handleRemoveCat(idx: number) {
    if (cats.length <= 1) return;
    setCats(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSliderChange(idx: number, val: number) {
    updateCat(idx, { percent: val });
  }

  function handlePctInput(idx: number, val: string) {
    const num = Math.min(100, Math.max(0, Number(val) || 0));
    updateCat(idx, { percent: num });
  }

  function handleTotalHoursChange(val: string) {
    setTotalHours(Math.min(24, Math.max(0, Number(val) || 0)));
  }

  function handleTotalMinsChange(val: string) {
    setTotalMins(Math.min(59, Math.max(0, Number(val) || 0)));
  }

  function handleCatHoursChange(idx: number, val: string) {
    updateCat(idx, { hours: Math.min(24, Math.max(0, Number(val) || 0)) });
  }

  function handleCatMinsChange(idx: number, val: string) {
    updateCat(idx, { minutes: Math.min(59, Math.max(0, Number(val) || 0)) });
  }

  function handleBack() {
    const nameChanged = logicName !== (existingLogic?.name ?? '');
    const catChanged = JSON.stringify(cats) !== JSON.stringify(
      existingLogic?.categories.map(makeDraftFromCategory) ?? [newDraftCategory()],
    );
    if (nameChanged || catChanged) {
      setShowCancelDialog(true);
    } else {
      navigate('/logics');
    }
  }

  async function handleSave() {
    if (!canSave || isSaving) return;

    let finalCategories: Category[];
    let finalTotal: number;

    if (direction === 1) {
      finalTotal = dir1Total;
      finalCategories = cats.map((c, i) => ({
        id: c.id,
        name: c.name.trim(),
        colorVar: c.colorVar,
        targetMinutes: hoursMinutesToTotal(c.hours, c.minutes),
        targetPercent: dir1Percents[i],
      }));
    } else {
      finalTotal = totalMinutes;
      finalCategories = cats.map((c, i) => ({
        id: c.id,
        name: c.name.trim(),
        colorVar: c.colorVar,
        targetMinutes: dir2Minutes[i],
        targetPercent: c.percent,
      }));
    }

    try {
      if (isNew) {
        const created = await createLogic.mutateAsync({
          name: logicName.trim(),
          totalTargetMinutes: finalTotal,
          categories: finalCategories.map(({ id: _id, ...rest }) => rest),
        });
        // 새 로직을 마지막 사용 로직으로 설정
        await patchSettings.mutateAsync({ lastUsedLogicId: created.id });
        showToast('로직이 저장됐어요.', 'success');
      } else {
        await updateLogic.mutateAsync({
          id: id!,
          input: {
            name: logicName.trim(),
            totalTargetMinutes: finalTotal,
            categories: finalCategories,
          },
        });
        showToast('로직을 수정했어요.', 'success');
      }
      navigate('/logics');
    } catch {
      showToast('저장 중 오류가 발생했어요.', 'danger');
    }
  }

  const unallocated = Math.max(0, Math.round((100 - dir2PercentSum) * 10) / 10);

  return (
    <div className={styles.editPage}>
      {/* 앱바 */}
      <header className={styles.appBar}>
        <button className={styles.backBtn} onClick={handleBack} aria-label="뒤로 가기">←</button>
        <span className={styles.appBarTitle}>{isNew ? '로직 만들기' : '로직 수정'}</span>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!canSave || isSaving}
          aria-disabled={!canSave || isSaving}
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </header>

      {/* 폼 */}
      <div className={styles.formSection}>
        {/* 로직명 */}
        <div className={`${styles.formGroup} ${styles.leftCol}`}>
          <div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>로직명</label>
              <input
                className={`${styles.inputField}${nameError && logicName !== '' ? ` ${styles.inputError}` : ''}`}
                type="text"
                maxLength={20}
                value={logicName}
                onChange={e => setLogicName(e.target.value)}
                placeholder="예: 수능 D-100"
                aria-label="로직명"
              />
              {nameError && logicName.trim() !== '' && (
                <span className={styles.errorMsg}>{nameError}</span>
              )}
              <span className={styles.formHint}>{logicName.length} / 20자</span>
            </div>
          </div>

          {/* 방향 토글 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>목표 설정 방향</label>
            <div className={styles.toggleGroup} role="group" aria-label="목표 설정 방향">
              <button
                className={`${styles.toggleOpt}${direction === 1 ? ` ${styles.toggleActive}` : ''}`}
                onClick={() => setDirection(1)}
                aria-pressed={direction === 1}
              >
                ① 카테고리 시간 합산
              </button>
              <button
                className={`${styles.toggleOpt}${direction === 2 ? ` ${styles.toggleActive}` : ''}`}
                onClick={() => setDirection(2)}
                aria-pressed={direction === 2}
              >
                ② 전체 시간 배분
              </button>
            </div>
          </div>

          {direction === 1 && (
            <div className={styles.formGroup}>
              <div className={styles.totalDisplay}>
                <span className={styles.totalDisplayLabel}>전체 목표 (자동 합산)</span>
                <span className={styles.totalDisplayValue}>
                  {dir1Total > 0 ? formatMinutes(dir1Total) : '—'}
                </span>
              </div>
            </div>
          )}

          {direction === 2 && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>전체 목표 시간</label>
              <div className={styles.totalTimeInput}>
                <div className={styles.timeInputGroup}>
                  <input
                    className={styles.timeInput}
                    type="number"
                    min={0}
                    max={24}
                    value={totalHours}
                    onChange={e => handleTotalHoursChange(e.target.value)}
                    aria-label="시간"
                  />
                  <span className={styles.timeUnit}>시간</span>
                </div>
                <div className={styles.timeInputGroup}>
                  <input
                    className={styles.timeInput}
                    type="number"
                    min={0}
                    max={59}
                    value={totalMins}
                    onChange={e => handleTotalMinsChange(e.target.value)}
                    aria-label="분"
                  />
                  <span className={styles.timeUnit}>분</span>
                </div>
                <span className={styles.timeCaption}>= {totalMinutes}분 (최대 1440분)</span>
              </div>

              {cats.length > 0 && (
                <>
                  <div className={styles.stackedBar} aria-label="퍼센트 배분 현황">
                    {cats.map((cat, i) => (
                      cat.percent > 0 && (
                        <div
                          key={cat.id}
                          className={styles.stackedBarSegment}
                          style={{
                            width: `${Math.min(cat.percent, 100)}%`,
                            background: `var(${cat.colorVar})`,
                          }}
                          title={`${cat.name || `카테고리 ${i + 1}`}`}
                        >
                          {cat.percent >= 8 ? (cat.name || `카테고리 ${i + 1}`) : ''}
                        </div>
                      )
                    ))}
                    {unallocated > 0.05 && (
                      <div
                        className={styles.stackedBarUnallocated}
                        style={{ width: `${unallocated}%` }}
                        title="미배분"
                      >
                        {unallocated >= 8 ? `미배분 ${Math.round(unallocated)}%` : ''}
                      </div>
                    )}
                  </div>
                  <div className={styles.stackedBarMeta}>
                    <span className={dir2Valid ? '' : styles.pctSumWarn}>
                      합계 {Math.round(dir2PercentSum * 10) / 10}%
                    </span>
                    {!dir2Valid && (
                      <span className={styles.pctSumWarn}>
                        {dir2PercentSum > 100
                          ? '100%를 넘으면 안 돼요.'
                          : '100%가 되도록 맞춰 주세요.'}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 카테고리 목록 */}
        <div className={`${styles.formGroup} ${styles.rightCol}`}>
          <div className={styles.formGroup}>
            <div className={styles.formLabel}>카테고리 목록</div>
            <span className={styles.formHint}>{cats.length} / {MAX_CATEGORIES}개</span>
          </div>

          <div className={styles.catList}>
            {cats.map((cat, idx) => {
              const catTotalMin = hoursMinutesToTotal(cat.hours, cat.minutes);
              const pct1 = dir1Percents[idx] ?? 0;
              const catMin2 = dir2Minutes[idx] ?? 0;

              return (
                <div key={cat.id} className={styles.catRow}>
                  <div className={styles.catRowTop}>
                    <button
                      className={styles.colorBtn}
                      style={{ background: `var(${cat.colorVar})` }}
                      onClick={() => setColorModalForIdx(idx)}
                      aria-label="카테고리 색상 선택"
                      title="색상 선택"
                    />
                    <input
                      className={`${styles.catNameInput}${dupErrors[idx] ? ` ${styles.inputError}` : ''}`}
                      type="text"
                      maxLength={20}
                      value={cat.name}
                      onChange={e => updateCat(idx, { name: e.target.value })}
                      placeholder={`카테고리 ${idx + 1}`}
                      aria-label={`카테고리 ${idx + 1} 이름`}
                    />
                    <button
                      className={styles.deleteCatBtn}
                      onClick={() => handleRemoveCat(idx)}
                      disabled={cats.length <= 1}
                      aria-label={`카테고리 ${idx + 1} 삭제`}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>

                  {dupErrors[idx] && (
                    <span className={styles.errorMsg}>{dupErrors[idx]}</span>
                  )}

                  {direction === 1 && (
                    <>
                      <div className={styles.catTimeRow}>
                        <div className={styles.timeInputGroup}>
                          <input
                            className={styles.timeInput}
                            type="number"
                            min={0}
                            max={24}
                            value={cat.hours}
                            onChange={e => handleCatHoursChange(idx, e.target.value)}
                            aria-label={`카테고리 ${idx + 1} 시간`}
                          />
                          <span className={styles.timeUnit}>시간</span>
                        </div>
                        <div className={styles.timeInputGroup}>
                          <input
                            className={styles.timeInput}
                            type="number"
                            min={0}
                            max={59}
                            value={cat.minutes}
                            onChange={e => handleCatMinsChange(idx, e.target.value)}
                            aria-label={`카테고리 ${idx + 1} 분`}
                          />
                          <span className={styles.timeUnit}>분</span>
                        </div>
                        <span className={styles.timeCaption}>= {catTotalMin}분</span>
                      </div>

                      {dir1TimeErrors[idx] && (
                        <span className={styles.errorMsg}>{dir1TimeErrors[idx]}</span>
                      )}

                      {dir1Total > 0 && (
                        <div className={styles.proportionRow}>
                          <span className={styles.proportionPct}>{pct1.toFixed(1)}%</span>
                          <div className={styles.proportionBar}>
                            <div
                              className={styles.proportionFill}
                              style={{ width: `${pct1}%`, background: `var(${cat.colorVar})` }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {direction === 2 && (
                    <div className={styles.catSliderRow}>
                      <input
                        className={styles.catSlider}
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={cat.percent}
                        onChange={e => handleSliderChange(idx, Number(e.target.value))}
                        style={{
                          background: `linear-gradient(to right, var(${cat.colorVar}) ${cat.percent}%, var(--color-border) ${cat.percent}%)`,
                        }}
                        aria-label={`카테고리 ${idx + 1} 비중`}
                      />
                      <input
                        className={styles.catPctInput}
                        type="number"
                        min={0}
                        max={100}
                        value={cat.percent}
                        onChange={e => handlePctInput(idx, e.target.value)}
                        aria-label={`카테고리 ${idx + 1} 퍼센트`}
                      />
                      <span className={styles.timeUnit}>%</span>
                      {totalMinutes > 0 && (
                        <span className={styles.catMinutesLabel}>{formatMinutes(catMin2)}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            className={styles.addCatBtn}
            onClick={handleAddCat}
            disabled={cats.length >= MAX_CATEGORIES}
            aria-label="카테고리 추가"
          >
            + 카테고리 추가
          </button>
        </div>
      </div>

      {/* 색상 팔레트 모달 */}
      {colorModalForIdx !== null && (
        <Modal title="카테고리 색상 선택" onClose={() => setColorModalForIdx(null)}>
          <div className={styles.colorPaletteGrid}>
            {CAT_COLORS.map(colorVar => {
              const isSelected = cats[colorModalForIdx]?.colorVar === colorVar;
              return (
                <button
                  key={colorVar}
                  className={`${styles.colorPaletteChip}${isSelected ? ` ${styles.colorPaletteChipSelected}` : ''}`}
                  style={{ background: `var(${colorVar})` }}
                  onClick={() => {
                    updateCat(colorModalForIdx, { colorVar });
                    setColorModalForIdx(null);
                  }}
                  aria-label={colorVar}
                  aria-pressed={isSelected}
                  title={colorVar}
                >
                  {isSelected && <span className={styles.colorPaletteCheck}>✓</span>}
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {/* 취소 확인 다이얼로그 */}
      {showCancelDialog && (
        <Dialog
          title="변경 내용을 저장하지 않고 나가시겠어요?"
          description="저장되지 않은 변경 사항은 사라져요."
          cancelLabel="계속 편집"
          confirmLabel="나가기"
          confirmVariant="danger"
          onCancel={() => setShowCancelDialog(false)}
          onConfirm={() => navigate('/logics')}
        />
      )}
    </div>
  );
}
