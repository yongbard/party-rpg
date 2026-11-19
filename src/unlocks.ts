// 진행에 따라 열리는 기능: 스테이지를 깨면 하나씩 열린다 (docs/2026-11-19-unlock-flow-design.md)
// 열림은 깬 스테이지로만 계산한다. 본 것(seen)은 저장에 적어 새로 열린 것만 빛낸다. 다른 파일을 가져오지 않는다 (node 로 시험)

export type Feature = 'hero' | 'speed' | 'gear' | 'bag' | 'missions' | 'auto' | 'swap' | 'summon' | 'form' | 'policy' | 'talent' | 'promo' | 'dungeon' | 'enhance' | 'tower' | 'craft' | 'raid' | 'mock';

/** 기능 → 이름, 깨야 할 스테이지 */
export const UNLOCKS: Record<Feature, { name: string; at: string }> = {
  hero: { name: '영웅', at: '1-1' },
  speed: { name: '배속', at: '1-1' },
  gear: { name: '장비', at: '1-2' },
  bag: { name: '가방', at: '1-2' },
  missions: { name: '임무', at: '1-3' },
  auto: { name: 'AUTO', at: '1-3' },
  swap: { name: '앞뒤 교대', at: '1-4' },
  summon: { name: '소환', at: '1-5' },
  form: { name: '편성', at: '1-5' },
  policy: { name: '행동 방침', at: '1-6' },
  talent: { name: '특성', at: '1-7' },
  promo: { name: '승격·별', at: '1-8' },
  dungeon: { name: '던전', at: '1-10' },
  enhance: { name: '장비 강화', at: '1-10' },
  tower: { name: '무한탑', at: '2-2' },
  craft: { name: '장비 제작', at: '2-4' },
  raid: { name: '레이드', at: '2-5' },
  mock: { name: '모의전', at: '2-7' },
};
const ALL = Object.keys(UNLOCKS) as Feature[];

export const isOpen = (cleared: string[], f: Feature) => cleared.includes(UNLOCKS[f].at);
export const opened = (cleared: string[]) => ALL.filter(f => isOpen(cleared, f));
export const newlyOpened = (before: string[], after: string[]) => ALL.filter(f => !isOpen(before, f) && isOpen(after, f));

/** 열렸는데 아직 안 눌러 본 것 */
export const isNew = (s: { cleared: string[]; seen?: string[] }, f: Feature) => isOpen(s.cleared, f) && !s.seen?.includes(f);

/** 본 것으로 적는다. 새로 적었으면 true (저장은 부른 쪽이) */
export function markSeen(s: { seen?: string[] }, f: Feature) {
  if (s.seen?.includes(f)) return false;
  (s.seen ??= []).push(f);
  return true;
}
