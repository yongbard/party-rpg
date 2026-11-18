// 전투 깊이 (design.md 2·3장): 진영 시너지, 행동 방침
import { addBonus, zeroBonus, type Bonus, type NumKey } from './items';

// ───────── 진영 ─────────

export type FactionId = 'kingdom' | 'forest' | 'wild' | 'abyss';
type Part = Partial<Record<NumKey, number>>;
export interface Faction { name: string; color: string; syn: string; two: Part; three: Part; cap3?: string; text2: string; text3: string }

/** 같은 진영 2명이면 소형, 3명 이상이면 대형 시너지 */
export const FACTIONS: Record<FactionId, Faction> = {
  kingdom: {
    name: '왕국', color: '#7fb8ff', syn: '방패의 맹세', two: { defPct: 0.12, drPct: 0.05 }, three: { defPct: 0.25, drPct: 0.1 }, cap3: 'syn_kingdom',
    text2: '방어력 +12%, 받는 피해 -5%', text3: '방어력 +25%, 받는 피해 -10%, 전투 시작 때 최대 체력 12% 보호막',
  },
  forest: {
    name: '숲', color: '#8fd88a', syn: '숲의 바람', two: { spd: 10, crit: 0.05 }, three: { spd: 20, crit: 0.1, critDmg: 0.2 },
    text2: '공격 속도 +10, 치명타 +5%', text3: '공격 속도 +20, 치명타 +10%, 치명 피해 +20%',
  },
  wild: {
    name: '황야', color: '#e0783a', syn: '피의 함성', two: { atkPct: 0.1, rage: 0.2 }, three: { atkPct: 0.2, hpPct: 0.1, rage: 0.4 },
    text2: '공격력 +10%, 체력이 줄수록 공격력 최대 +20%', text3: '공격력 +20%, 체력 +10%, 체력이 줄수록 공격력 최대 +40%',
  },
  abyss: {
    name: '심연', color: '#b07ce0', syn: '심연의 갈증', two: { lifesteal: 0.06, gaugePct: 0.1 }, three: { lifesteal: 0.12, gaugePct: 0.2 }, cap3: 'syn_abyss',
    text2: '흡혈 6%, 필살기 게이지 +10%', text3: '흡혈 12%, 필살기 게이지 +20%, 적을 쓰러뜨리면 게이지 +15',
  },
};
export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

/** 영웅 → 진영 (진영마다 4명) */
export const FACTION_OF: Record<string, FactionId> = {
  leon: 'kingdom', dorin: 'kingdom', nora: 'kingdom', sera: 'kingdom',
  kyle: 'forest', lia: 'forest', mia: 'forest', ella: 'forest',
  bran: 'wild', gorga: 'wild', garsh: 'wild', jin: 'wild',
  kix: 'abyss', morgan: 'abyss', pug: 'abyss', hagen: 'abyss',
};
export const membersOf = (f: FactionId) => Object.keys(FACTION_OF).filter(id => FACTION_OF[id] === f);

/** 파티의 진영 시너지: 켜진 것과 합친 보너스 */
export function synergy(ids: string[]) {
  const n: Partial<Record<FactionId, number>> = {};
  for (const id of ids) if (FACTION_OF[id]) n[FACTION_OF[id]] = (n[FACTION_OF[id]] ?? 0) + 1;
  let bonus: Bonus = zeroBonus();
  const active: { id: FactionId; n: number; big: boolean; text: string }[] = [];
  for (const id of FACTION_IDS) {
    const k = n[id] ?? 0;
    if (k < 2) continue;
    const f = FACTIONS[id], big = k >= 3;
    const b = zeroBonus();
    for (const [key, v] of Object.entries(big ? f.three : f.two) as [NumKey, number][]) b[key] += v;
    if (big && f.cap3) b.caps.push(f.cap3);
    bonus = addBonus(bonus, b);
    active.push({ id, n: k, big, text: big ? f.text3 : f.text2 });
  }
  return { bonus, active };
}

// ───────── 행동 방침 ─────────

export type Policy = 'attack' | 'survive' | 'protect' | 'weak';
export const POLICIES: { id: Policy; name: string; desc: string }[] = [
  { id: 'attack', name: '공격 우선', desc: '영웅 본래 방식대로 적을 고른다' },
  { id: 'survive', name: '생존 우선', desc: '위협을 40% 덜 만든다 · 체력이 40% 아래로 떨어지면 잠깐 뒤로 물러난다' },
  { id: 'protect', name: '아군 보호', desc: '가장 다친 아군을 노리는 적부터 친다 · 위협을 30% 더 만든다' },
  { id: 'weak', name: '약한 적부터', desc: '남은 체력이 가장 적은 적부터 마무리한다' },
];
export const policyThreat = (p: Policy) => (p === 'survive' ? 0.6 : p === 'protect' ? 1.3 : 1);
