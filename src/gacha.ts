// 뽑기: 보석 하나로 영웅·장비·무기를 뽑는다. 결과는 연출 전에 저장한다 (새로고침으로 다시 뽑기 방지)
import { GRADES, HEROES } from './data';
import { ITEM_BASES, ITEM_MUL, MAX_ENHANCE, rollItem, type Item, type Slot } from './items';
import { UNIQUES } from './uniques';
import { addItem, writeSave, type SaveData } from './save';

/** 등급(영웅은 잠재 등급) 확률 % — design.md 3.3 */
export const RATES = [45, 30, 16, 6.5, 1.8, 0.5, 0.15, 0.05];

export type BannerId = 'hero' | 'pickup' | 'gear' | 'weapon';
interface Pity { key: 'hero' | 'hero5' | 'gear' | 'pick'; n: number; min: number }
export interface Banner {
  id: BannerId; name: string; desc: string; cost: number; cost10: number;
  ten: number;            // 10연에 이 등급 이상 1개 보장
  pity: Pity[];           // n 회 안에 min 등급 이상 보장 (불멸·초월은 천장 없음: 천장으로는 신화까지만)
}
export const BANNERS: Banner[] = [
  { id: 'hero', name: '영웅 소환', desc: '영웅을 부른다. 이미 있는 영웅이면 그 영웅의 조각이 된다 · 조각을 모아 등급을 올린다', cost: 150, cost10: 1350, ten: 2, pity: [{ key: 'hero', n: 80, min: 4 }, { key: 'hero5', n: 300, min: 5 }] },
  { id: 'pickup', name: '픽업 소환', desc: '이번 주 픽업 영웅이 같은 등급 안에서 2배로 나온다 · 80회 안에 픽업 영웅 확정 (남은 횟수는 다음 주 픽업으로 이어진다)', cost: 150, cost10: 1350, ten: 2, pity: [{ key: 'pick', n: 80, min: 4 }] },
  { id: 'gear', name: '장비 소환', desc: '무기·방패·투구·갑옷·망토·장신구·문장 중 하나', cost: 100, cost10: 900, ten: 3, pity: [{ key: 'gear', n: 60, min: 4 }] },
  { id: 'weapon', name: '무기 소환', desc: '무기만 나온다', cost: 100, cost10: 900, ten: 3, pity: [] },
];
const PITY_MAX = 5;   // 천장으로 정해지는 등급의 위 끝 (신화)

/** 중복 영웅 한 번에 받는 조각 (잠재 등급별) */
export const DUP_SHARDS = [10, 10, 10, 15, 20, 30, 50, 80];
/** g → g+1 승격에 드는 조각·골드 */
export const PROMOTE: [number, number][] = [[20, 1000], [40, 3000], [60, 8000], [100, 20000], [150, 50000], [250, 100000], [400, 200000]];
/** 승격석: 전설 이상으로 올릴 때 (지금 등급별). 요일 던전·레이드에서 얻는다 */
export const PROMOTE_STONE = [0, 0, 0, 5, 10, 20, 40];
/** 분해하면 받는 골드 (등급별) */
export const SALVAGE_GOLD = [50, 100, 200, 400, 1000, 2500, 6000, 15000];

export type Pull =
  | { kind: 'hero'; id: string; grade: number; isNew: boolean; shards: number }
  | { kind: 'item'; item: Item; grade: number };

/** min ~ max 등급 안에서, allowed 에 든 등급만 확률표대로 뽑는다 */
function rollIn(min: number, max: number, allowed: (g: number) => boolean) {
  const w = RATES.map((r, g) => (g >= min && g <= max && allowed(g) ? r : 0));
  let sum = w.reduce((a, b) => a + b, 0);
  if (!sum) return RATES.findIndex((_r, g) => g >= min && allowed(g));
  let r = Math.random() * sum;
  for (let g = 0; g < w.length; g++) { r -= w[g]; if (r < 0) return g; }
  return max;
}

const heroPotentials = () => new Set(HEROES.map(h => h.maxGrade ?? 2));
const isHeroBanner = (id: BannerId) => id === 'hero' || id === 'pickup';

/** 이번 주 픽업 영웅: 잠재 전설·신화 영웅을 월요일마다 돌아가며 (천장으로 확정할 수 있는 등급만) */
export function pickupHero(now = Date.now()) {
  const pool = HEROES.filter(h => h.maxGrade === 4 || h.maxGrade === 5);
  const day = Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 864e5);   // 이 기기 시간대의 날짜
  const week = Math.floor((day + 3) / 7);   // 1970-01-01 은 목요일 → +3 이면 월요일에 바뀐다
  return { def: pool[week % pool.length], left: 7 - ((day + 3) % 7) };
}
const pickWeight = (h: { id: string }, pickId?: string) => (h.id === pickId ? 2 : 1);

/** 연출에서 멈칫하며 뒤집을 등급: 전설 이상, 단 그 소환에서 가장 흔한 등급보다는 높아야 한다 (영웅이 전부 전설 잠재일 때 매 장 멈추지 않게) */
export const hiFrom = (id: BannerId) => (isHeroBanner(id) ? Math.max(4, Math.min(...heroPotentials()) + 1) : 4);

/** 영웅 소환 확률표: 영웅마다 % (잠재 등급이 없는 칸은 빼고 다시 나눈다). 픽업 영웅은 같은 등급 안에서 2배 */
export function heroRates(pickId?: string) {
  const P = heroPotentials();
  const sum = [...P].reduce((a, g) => a + RATES[g], 0);
  return HEROES.map(h => {
    const g = h.maxGrade ?? 2;
    const same = HEROES.filter(x => (x.maxGrade ?? 2) === g);
    const w = same.reduce((a, x) => a + pickWeight(x, pickId), 0);
    return { id: h.id, name: h.name, grade: g, pct: (RATES[g] / sum) * 100 * pickWeight(h, pickId) / w };
  }).sort((a, b) => b.grade - a.grade || b.pct - a.pct);
}

/** 장비 칸: 그 등급에 나올 기본형이 있는 칸 중에서 고른다 */
const GEAR_SLOTS: [Slot, number][] = [['weapon', 30], ['offhand', 10], ['helmet', 15], ['armor', 10], ['cloak', 15], ['acc', 15], ['emblem', 5]];
const slotHas = (slot: Slot, g: number) => [...ITEM_BASES.values()].some(b => b.slot === slot && b.minGrade <= g && g - b.minGrade <= 3);
function pickSlot(g: number): Slot {
  const ok = GEAR_SLOTS.filter(([s]) => slotHas(s, g));
  let r = Math.random() * ok.reduce((a, [, w]) => a + w, 0);
  for (const [s, w] of ok) { r -= w; if (r < 0) return s; }
  return ok[0][0];
}

/** 뽑고 저장한다. 보석이 모자라면 null */
export function summon(save: SaveData, id: BannerId, count: 1 | 10): Pull[] | null {
  const bn = BANNERS.find(b => b.id === id)!;
  const cost = count === 10 ? bn.cost10 : bn.cost;
  if (save.gems < cost) return null;
  save.gems -= cost;
  const pity = (save.pity ??= { hero: 0, hero5: 0, gear: 0, pick: 0 });
  const P = heroPotentials();
  const allowed = isHeroBanner(id) ? (g: number) => P.has(g) : (g: number) => id !== 'weapon' || slotHas('weapon', g);
  const pick = id === 'pickup' ? pickupHero().def : null;
  const out: Pull[] = [];
  for (let i = 0; i < count; i++) {
    // 천장: 카운터가 다 찼으면 그 등급 이상 (가장 높은 천장부터)
    let min = 0, forcePick = false;
    for (const p of bn.pity) if ((pity[p.key] ?? 0) + 1 >= p.n) { min = Math.max(min, p.min); if (p.key === 'pick') forcePick = true; }
    // 10연 보장: 마지막 한 장까지 보장 등급이 안 나왔으면
    if (count === 10 && i === 9 && !out.some(o => o.grade >= bn.ten)) min = Math.max(min, bn.ten);
    const g = forcePick && pick ? pick.maxGrade! : rollIn(min, min >= 4 ? PITY_MAX : 7, allowed);
    if (isHeroBanner(id)) {
      const pool = HEROES.filter(h => (h.maxGrade ?? 2) === g);
      let r = Math.random() * pool.reduce((a, h) => a + pickWeight(h, pick?.id), 0);
      const h = forcePick && pick ? pick : pool.find(x => (r -= pickWeight(x, pick?.id)) < 0) ?? pool[0];
      // 천장 카운터: 등급 천장은 그 등급 이상이 나오면, 픽업 천장은 픽업 영웅이 나오면 처음부터
      for (const p of bn.pity) pity[p.key] = (p.key === 'pick' ? h.id === pick?.id : g >= p.min) ? 0 : (pity[p.key] ?? 0) + 1;
      if (!save.heroes[h.id]) {
        save.heroes[h.id] = { level: 1, grade: Math.max(0, g - 3) };   // 잠재보다 3단계 아래에서 시작
        out.push({ kind: 'hero', id: h.id, grade: g, isNew: true, shards: 0 });
      } else {
        const n = DUP_SHARDS[g];
        (save.shards ??= {})[h.id] = (save.shards[h.id] ?? 0) + n;
        out.push({ kind: 'hero', id: h.id, grade: g, isNew: false, shards: n });
      }
    } else {
      for (const p of bn.pity) pity[p.key] = g >= p.min ? 0 : (pity[p.key] ?? 0) + 1;
      const item = addItem(save, rollItem(0, g, id === 'weapon' ? 'weapon' : pickSlot(g)));
      out.push({ kind: 'item', item, grade: g });
    }
  }
  writeSave(save);
  return out;
}

/** 승격할 수 있나: 이유를 돌려주고, 되면 null */
export function canPromote(save: SaveData, heroId: string): string | null {
  const def = HEROES.find(h => h.id === heroId)!;
  const g = save.heroes[heroId].grade;
  if (g >= (def.maxGrade ?? 2)) return `${GRADES[g]}이(가) 이 영웅의 끝이다`;
  const [sh, gold] = PROMOTE[g];
  if ((save.shards?.[heroId] ?? 0) < sh) return '조각이 모자란다';
  if (save.gold < gold) return '골드가 모자란다';
  if ((save.mats?.promo ?? 0) < PROMOTE_STONE[g]) return '승격석이 모자란다';
  return null;
}

export function promote(save: SaveData, heroId: string) {
  if (canPromote(save, heroId)) return false;
  const h = save.heroes[heroId];
  const [sh, gold] = PROMOTE[h.grade];
  save.shards![heroId] -= sh;
  save.gold -= gold;
  if (PROMOTE_STONE[h.grade]) save.mats!.promo! -= PROMOTE_STONE[h.grade];
  h.grade++;
  writeSave(save);
  return true;
}

/** 분해로 얻는 강화석·정수 (등급별) */
export const SALVAGE_STONE = [1, 2, 4, 8, 15, 30, 60, 120];
export const SALVAGE_ESSENCE = [0, 0, 1, 2, 5, 12, 30, 60];

/** 강화 비용 (지금 단계 → 다음 단계). 실패 없음 */
export function enhanceCost(it: Item) {
  const lv = it.lv ?? 0;
  return { gold: Math.round(100 * (lv + 1) * ITEM_MUL[it.grade]), stone: (lv + 1) * (1 + Math.floor(it.grade / 2)) };
}
/** 이 아이템에 지금까지 쓴 강화석 (분해 때 절반을 돌려준다) */
const spentStone = (it: Item) => Array.from({ length: it.lv ?? 0 }, (_, k) => (k + 1) * (1 + Math.floor(it.grade / 2))).reduce((a, b) => a + b, 0);
export const salvageOf = (it: Item) => ({ gold: SALVAGE_GOLD[it.grade], stone: SALVAGE_STONE[it.grade] + Math.floor(spentStone(it) / 2), essence: SALVAGE_ESSENCE[it.grade] });

const mats = (save: SaveData) => (save.mats ??= { stone: 0, essence: 0 });

/** 분해: 끼고 있지 않은 아이템을 골드·강화석·정수로 바꾼다 */
export function salvage(save: SaveData, uids: number[]) {
  const worn = new Set(Object.values(save.heroes).flatMap(h => Object.values(h.equip ?? {})));
  let gold = 0, stone = 0, essence = 0, n = 0;
  save.items = (save.items ?? []).filter(it => {
    if (!uids.includes(it.uid) || worn.has(it.uid)) return true;
    const r = salvageOf(it);
    gold += r.gold; stone += r.stone; essence += r.essence;
    n++;
    return false;
  });
  save.gold += gold;
  mats(save).stone += stone;
  mats(save).essence += essence;
  writeSave(save);
  return { gold, stone, essence, n };
}

export const canEnhance = (save: SaveData, it: Item) => {
  const c = enhanceCost(it);
  return (it.lv ?? 0) < MAX_ENHANCE && save.gold >= c.gold && mats(save).stone >= c.stone;
};
export function enhance(save: SaveData, uid: number) {
  const it = save.items?.find(i => i.uid === uid);
  if (!it || !canEnhance(save, it)) return false;
  const c = enhanceCost(it);
  save.gold -= c.gold;
  mats(save).stone -= c.stone;
  it.lv = (it.lv ?? 0) + 1;
  writeSave(save);
  return true;
}

/** 제작: 정수 + 골드로 고유 효과를 골라 전설 장비를 확정으로 만든다 (부위·기본형·세트는 무작위) */
export const CRAFT = { essence: 30, gold: 30000, grade: 4 };
export const canCraft = (save: SaveData) => save.gold >= CRAFT.gold && mats(save).essence >= CRAFT.essence;
export function craft(save: SaveData, uq: string) {
  if (!UNIQUES[uq] || !canCraft(save)) return null;
  save.gold -= CRAFT.gold;
  mats(save).essence -= CRAFT.essence;
  const it = addItem(save, rollItem(0, CRAFT.grade, UNIQUES[uq].slot, Math.random, uq));
  writeSave(save);
  return it;
}
