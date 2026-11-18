// 장비 고유 효과(전설 이상)와 세트 (design.md 4장). 전투 처리는 battle.ts 에서 u.uq(id) 로 찾는다
import type { Bonus, Slot } from './items';

export interface Unique {
  name: string; slot: Slot;
  desc: (p: number) => string;   // p = 강화 배율 (1, +10 에서 1.25, +15 에서 1.5)
  desc2: string;                 // 신화 이상: 조건부 2차 효과
  party?: boolean;               // 불멸 이상이면 파티 전체에 절반 세기로 걸린다
}
const pc = (v: number) => `${Math.round(v * 100)}%`;
export const UNIQUES: Record<string, Unique> = {
  bloodpact: { name: '피의 서약', slot: 'weapon', desc: p => `가한 피해의 ${pc(0.15 * p)}만큼 체력이 가장 낮은 아군을 치유`, desc2: '그 아군 체력이 30% 아래면 치유 2배' },
  lonely: { name: '고독한 검', slot: 'weapon', desc: p => `살아 있는 아군이 2명 이하면 공격 +${pc(0.4 * p)}, 공격 속도 +20%`, desc2: '혼자 남으면 받는 피해 −30%' },
  inverse: { name: '역천의 지팡이', slot: 'weapon', desc: p => `치유할 때 치유량의 ${pc(0.4 * p)}만큼 가장 가까운 적에게 피해`, desc2: '아군 체력이 모두 가득하면 공격 +25%' },
  arc: { name: '연쇄 번개', slot: 'weapon', desc: p => `기본 공격이 30% 확률로 근처 다른 적에게 ${pc(0.5 * p)} 피해로 튄다`, desc2: '튈 확률 50%' },
  reaper: { name: '처형자의 칼날', slot: 'weapon', desc: p => `체력 25% 아래 적에게 주는 피해 +${pc(0.5 * p)}`, desc2: '처치하면 필살기 게이지 +15', party: true },
  bulwark: { name: '반사 방패', slot: 'offhand', desc: p => `받은 피해의 ${pc(0.15 * p)}를 공격자에게 되돌린다`, desc2: '체력 50% 아래면 되돌리는 피해 2배' },
  guardian: { name: '수호자의 면갑', slot: 'helmet', desc: p => `적이 2배로 노린다, 받는 피해 −${pc(0.2 * p)}, 공격 −15%`, desc2: '전투 시작 때 최대 체력 15% 보호막' },
  focus: { name: '집중의 투구', slot: 'helmet', desc: p => `필살기 게이지가 1초에 ${(2 * p).toFixed(1)}씩 더 찬다`, desc2: '필살기 뒤 3초 동안 모든 공격 치명', party: true },
  undying: { name: '불사의 갑옷', slot: 'armor', desc: p => `한 번, 쓰러질 피해를 받으면 체력 ${pc(0.3 * p)}로 버틴다`, desc2: '버틸 때 주변 적을 2초 기절' },
  regen: { name: '재생의 갑옷', slot: 'armor', desc: p => `3초마다 최대 체력 ${pc(0.03 * p)} 회복`, desc2: '체력 30% 아래면 회복 2배', party: true },
  shade: { name: '그림자 망토', slot: 'cloak', desc: p => `웨이브 처음 6초 동안 적이 노리지 않고, 첫 공격 피해 +${pc(1 * p)}`, desc2: '그 6초 동안 공격 속도 +30%' },
  gale: { name: '질풍 망토', slot: 'cloak', desc: p => `공격 속도 +${Math.round(15 * p)}`, desc2: '적을 처치하면 3초 동안 공격 속도 +30', party: true },
  vamp: { name: '흡혈 반지', slot: 'acc', desc: p => `흡혈 ${pc(0.08 * p)}`, desc2: '체력이 가득하면 흡혈이 보호막이 된다', party: true },
  keen: { name: '날카로운 눈', slot: 'acc', desc: p => `치명타가 터지면 필살기 게이지 +${Math.round(5 * p)}`, desc2: '치명 피해 +30%', party: true },
  sacrifice: { name: '희생의 문장', slot: 'emblem', desc: p => `아군이 쓰러지면 남은 아군 전원 공격 +${pc(0.15 * p)} (중첩)`, desc2: '쓰러질 때 남은 아군 체력 20% 회복' },
  resonance: { name: '공명의 문장', slot: 'emblem', desc: p => `이 영웅이 필살기를 쓰면 다른 아군 필살기 게이지 +${Math.round(20 * p)}`, desc2: '그때 아군 전원 5초 동안 공격 +15%' },
};
export const UNIQUE_IDS = Object.keys(UNIQUES);
/** 강화 단계에 따른 고유 효과 세기: +10, +15 에서 강해진다 */
export const uqPower = (lv = 0) => 1 + (lv >= 10 ? 0.25 : 0) + (lv >= 15 ? 0.25 : 0);

export interface SetDef { name: string; two: Partial<Omit<Bonus, 'caps' | 'uniq' | 'uniq2' | 'party'>>; twoText: string; fourText: string }
/** 세트: 2개 = 능력치, 4개 = 파티 운영이 바뀌는 효과 (끝 노드처럼 caps 에 'set_{id}') */
export const SETS: Record<string, SetDef> = {
  iron: { name: '철벽', two: { defPct: 0.15 }, twoText: '방어력 +15%', fourText: '살아 있는 동안 다른 아군이 받는 피해의 20%를 대신 받는다 (이것으로는 쓰러지지 않는다)' },
  storm: { name: '광풍', two: { spd: 8 }, twoText: '공격 속도 +8', fourText: '기본 공격 3번마다 한 번 더 친다' },
  sanct: { name: '성역', two: { healPct: 0.15 }, twoText: '치유량 +15%', fourText: '필살기를 쓰면 아군 전원 최대 체력 10% 회복' },
  blood: { name: '피의 맹세', two: { lifesteal: 0.05 }, twoText: '흡혈 5%', fourText: '체력이 낮을수록 공격이 오른다 (빈사 때 최대 +50%)' },
  star: { name: '별의 인도', two: { gaugePct: 0.15 }, twoText: '필살기 충전 +15%', fourText: '필살기를 쓰면 다른 아군 필살기 게이지 +15' },
};
export const SET_IDS = Object.keys(SETS);
