// 장비: 기본형(모델·부위·무기군), 아이템(등급·주옵션·부옵션), 장착 규칙, 장착한 모습
import type { Look } from './data';

export type Slot = 'weapon' | 'offhand' | 'helmet' | 'armor' | 'cloak' | 'acc' | 'emblem';
export type EquipSlot = 'weapon' | 'offhand' | 'helmet' | 'armor' | 'cloak' | 'acc1' | 'acc2' | 'emblem';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'offhand', 'helmet', 'armor', 'cloak', 'acc1', 'acc2', 'emblem'];
export const SLOT_NAMES: Record<EquipSlot, string> = { weapon: '무기', offhand: '방패', helmet: '투구', armor: '갑옷', cloak: '망토', acc1: '장신구', acc2: '장신구', emblem: '문장' };
export const slotOf = (s: EquipSlot): Slot => (s === 'acc1' || s === 'acc2' ? 'acc' : s);

export type WClass = 'sword' | 'axe' | 'hammer' | 'mace' | 'dagger' | 'spear' | 'staff' | 'wand' | 'bow';
export type Stat = 'atk' | 'hp' | 'def' | 'crit' | 'critDmg' | 'spd' | 'atkPct';
export const STAT_NAMES: Record<Stat, string> = { atk: '공격력', hp: '체력', def: '방어력', crit: '치명타', critDmg: '치명 피해', spd: '공격 속도', atkPct: '공격력%' };
const PCT: Stat[] = ['crit', 'critDmg', 'atkPct'];
export const fmtStat = (s: Stat, v: number) => (PCT.includes(s) ? `${(v * 100).toFixed(1)}%` : `${Math.round(v)}`);

export interface ItemBase {
  id: string; name: string; slot: Slot;
  model?: string;            // q/weapon/… q/gear/… (갑옷은 'ranger' | 'peasant' 처럼 성별 없는 이름)
  wclass?: WClass; hands?: 1 | 2;
  minGrade: number;          // 이 등급부터 나온다 (같은 모델이 일반과 초월에 같이 나오지 않게)
  icon: string;
}

export interface Item { uid: number; base: string; grade: number; main: [Stat, number]; subs: [Stat, number][] }

// ───────── 기본형 목록 ─────────

const TIER = ['녹슨', '무쇠', '강철', '기사의', '장인의', '명장의', '왕실'];
const BINBUN: [string, string, WClass, 1 | 2, string][] = [
  ['Short_Sword', '숏소드', 'sword', 1, 'broadsword'], ['Long_Sword', '장검', 'sword', 1, 'broadsword'],
  ['Sabre', '세이버', 'sword', 1, 'saber-slash'], ['Axe', '도끼', 'axe', 1, 'battle-axe'],
  ['Mace', '철퇴', 'mace', 1, 'spiked-mace'], ['Dagger', '단검', 'dagger', 1, 'plain-dagger'],
  ['Hammer', '전투 망치', 'hammer', 2, 'warhammer'], ['Spear', '창', 'spear', 2, 'halberd'],
  ['Pickaxe', '곡괭이', 'hammer', 2, 'warhammer'],
];
const bases: ItemBase[] = [];
for (const [file, name, wclass, hands, icon] of BINBUN) {
  for (let v = 1; v <= 7; v++) {
    bases.push({ id: `${file}_0${v}`, name: `${TIER[v - 1]} ${name}`, slot: 'weapon', model: `q/weapon/${file}_0${v}`, wclass, hands, minGrade: Math.max(0, v - 3), icon });
  }
}
// KayKit 판타지 무기: 모양이 화려해 위쪽 등급에서만 나온다
const KK: [string, string, WClass | 'shield', 1 | 2, number, string][] = [
  ['sword_A', '룬 검', 'sword', 1, 3, 'broadsword'], ['sword_B', '송곳니 검', 'sword', 1, 3, 'broadsword'],
  ['sword_C', '서리 검', 'sword', 1, 4, 'broadsword'], ['sword_D', '불꽃 검', 'sword', 1, 4, 'broadsword'],
  ['sword_E', '성검', 'sword', 1, 5, 'broadsword'],
  ['axe_A', '전쟁 도끼', 'axe', 1, 3, 'battle-axe'], ['axe_B', '쌍날 도끼', 'axe', 1, 4, 'battle-axe'], ['axe_C', '피의 도끼', 'axe', 2, 5, 'battle-axe'],
  ['hammer_A', '거인의 망치', 'hammer', 2, 3, 'warhammer'], ['hammer_B', '천둥 망치', 'hammer', 2, 4, 'warhammer'], ['hammer_C', '심판의 망치', 'hammer', 2, 5, 'warhammer'],
  ['dagger_A', '그림자 단검', 'dagger', 1, 3, 'plain-dagger'], ['dagger_B', '독니 단검', 'dagger', 1, 4, 'plain-dagger'],
  ['halberd', '미늘창', 'spear', 2, 4, 'halberd'], ['spear_A', '용창', 'spear', 2, 5, 'halberd'],
  ['staff_A', '수정 지팡이', 'staff', 2, 2, 'wizard-staff'], ['staff_B', '별의 지팡이', 'staff', 2, 4, 'wizard-staff'],
  ['wand_A', '마법 완드', 'wand', 1, 0, 'crystal-wand'],
  ['bow_A_withString', '사냥 활', 'bow', 2, 0, 'pocket-bow'], ['bow_B_withString', '정령 활', 'bow', 2, 3, 'pocket-bow'],
  ['shield_A', '나무 방패', 'shield', 1, 0, 'round-shield'], ['shield_B', '기사 방패', 'shield', 1, 2, 'round-shield'], ['shield_C', '가시 방패', 'shield', 1, 4, 'round-shield'],
];
for (const [file, name, wclass, hands, minGrade, icon] of KK) {
  bases.push(wclass === 'shield'
    ? { id: `kk_${file}`, name, slot: 'offhand', model: `q/weapon/kk_${file}`, hands: 1, minGrade, icon }
    : { id: `kk_${file}`, name, slot: 'weapon', model: `q/weapon/kk_${file}`, wclass, hands, minGrade, icon });
}
const GEAR: [string, string, Slot, number, string][] = [
  ['Barbarian_Hat', '야만 전사 투구', 'helmet', 0, 'visored-helm'], ['Skeleton_Rogue_Hood', '그림자 두건', 'helmet', 1, 'visored-helm'],
  ['Mage_Hat', '마법사 모자', 'helmet', 1, 'visored-helm'], ['Knight_Helmet', '기사 투구', 'helmet', 2, 'visored-helm'],
  ['Skeleton_Mage_Hat', '망자의 모자', 'helmet', 3, 'visored-helm'], ['Skeleton_Warrior_Helmet', '해골 왕의 투구', 'helmet', 4, 'visored-helm'],
  ['Rogue_Cape', '여행자 망토', 'cloak', 0, 'cape'], ['Barbarian_Cape', '모피 망토', 'cloak', 1, 'cape'],
  ['Mage_Cape', '마도사 망토', 'cloak', 2, 'cape'], ['Knight_Cape', '기사단 망토', 'cloak', 3, 'cape'],
  ['Skeleton_Rogue_Cape', '망령의 망토', 'cloak', 4, 'cape'],
];
for (const [file, name, slot, minGrade, icon] of GEAR) bases.push({ id: file, name, slot, model: `q/gear/${file}`, minGrade, icon });
bases.push(
  { id: 'armor_peasant', name: '천 옷', slot: 'armor', model: 'peasant', minGrade: 0, icon: 'leather-vest' },
  { id: 'armor_ranger', name: '레인저 조끼', slot: 'armor', model: 'ranger', minGrade: 1, icon: 'breastplate' },
);
const ACC: [string, string, number][] = [['구리 반지', 'diamond-ring', 0], ['은 목걸이', 'gem-pendant', 0], ['루비 반지', 'diamond-ring', 2], ['달의 펜던트', 'gem-pendant', 3], ['용의 눈', 'diamond-ring', 5]];
ACC.forEach(([name, icon, minGrade], i) => bases.push({ id: `acc_${i}`, name, slot: 'acc', minGrade, icon }));
const EMB: [string, number][] = [['견습 문장', 0], ['기사단 문장', 2], ['왕가의 문장', 4]];
EMB.forEach(([name, minGrade], i) => bases.push({ id: `emblem_${i}`, name, slot: 'emblem', minGrade, icon: 'medal' }));

export const ITEM_BASES = new Map(bases.map(b => [b.id, b]));
export const baseOf = (it: Item) => ITEM_BASES.get(it.base)!;

// ───────── 능력치 ─────────

const ITEM_MUL = [1, 1.3, 1.7, 2.2, 2.9, 3.8, 5, 6.5];   // 등급별 수치 배율
const SUB_COUNT = [0, 0, 1, 1, 2, 2, 3, 4];
const MAIN: Record<Slot, [Stat, number]> = {
  weapon: ['atk', 14], offhand: ['def', 10], helmet: ['hp', 90], armor: ['def', 12],
  cloak: ['hp', 70], acc: ['crit', 0.02], emblem: ['atkPct', 0.03],
};
const SUB_BASE: Record<Stat, number> = { atk: 5, hp: 40, def: 4, crit: 0.012, critDmg: 0.04, spd: 2, atkPct: 0.015 };
const SUB_POOL: Stat[] = ['atk', 'hp', 'def', 'crit', 'critDmg', 'spd'];

export function makeItem(uid: number, baseId: string, grade: number, rnd = Math.random): Item {
  const b = ITEM_BASES.get(baseId)!;
  let [stat, v] = MAIN[b.slot];
  if (b.slot === 'weapon' && b.hands === 2) v *= 1.4;     // 양손 무기는 방패를 못 드는 대신 세다
  if (b.slot === 'acc' && rnd() < 0.5) { stat = 'critDmg'; v = 0.05; }
  const main: [Stat, number] = [stat, v * ITEM_MUL[grade] * (0.95 + rnd() * 0.1)];
  const pool = SUB_POOL.filter(s => s !== stat);
  const subs: [Stat, number][] = [];
  for (let i = 0; i < SUB_COUNT[grade]; i++) {
    const s = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    subs.push([s, SUB_BASE[s] * ITEM_MUL[grade] * (0.7 + rnd() * 0.6)]);
  }
  return { uid, base: baseId, grade, main, subs };
}

/** 등급을 정하고 그 등급에 나올 수 있는 기본형 중 하나로 아이템을 만든다 */
export function rollItem(uid: number, grade: number, slot?: Slot, rnd = Math.random): Item {
  const pool = bases.filter(b => b.minGrade <= grade && grade - b.minGrade <= 3 && (!slot || b.slot === slot));
  return makeItem(uid, pool[Math.floor(rnd() * pool.length)].id, grade, rnd);
}

/** 확률표에서 등급을 뽑는다 */
export function rollGrade(weights: number[], rnd = Math.random) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * sum;
  for (let g = 0; g < weights.length; g++) { r -= weights[g]; if (r < 0) return g; }
  return 0;
}

export interface Bonus { atk: number; hp: number; def: number; crit: number; critDmg: number; spd: number; atkPct: number }
export const zeroBonus = (): Bonus => ({ atk: 0, hp: 0, def: 0, crit: 0, critDmg: 0, spd: 0, atkPct: 0 });

export function bonusOf(items: Item[]): Bonus {
  const b = zeroBonus();
  for (const it of items) for (const [s, v] of [it.main, ...it.subs]) b[s] += v;
  return b;
}

// ───────── 장착 규칙 ─────────

/** 영웅이 쓸 수 있는 무기군 */
export const HERO_WEAPONS: Record<string, WClass[]> = {
  leon: ['sword', 'mace', 'axe'],
  bran: ['axe', 'hammer', 'spear'],
  sera: ['staff', 'wand'],
  kyle: ['bow', 'dagger'],
};

const handsOfModel = (key?: string) => (key && /Hammer|Spear|Pickaxe|kk_hammer|kk_halberd|kk_spear|kk_staff|kk_bow|kk_axe_C/.test(key) ? 2 : 1);

/** 이 칸에 이 아이템을 낄 수 있나. 이유를 돌려주고, 되면 null */
export function canEquip(heroId: string, slot: EquipSlot, it: Item, weapon?: Item): string | null {
  const b = baseOf(it);
  if (b.slot !== slotOf(slot)) return '부위가 다르다';
  if (b.slot === 'weapon' && !HERO_WEAPONS[heroId]?.includes(b.wclass!)) return '이 영웅이 쓰지 않는 무기';
  if (b.slot === 'offhand' && weapon && baseOf(weapon).hands === 2) return '양손 무기를 들고 있다';
  return null;
}

/** 지금 등급 외형 위에 장착한 장비를 덮어쓴다 */
export function equippedLook(look: Look, equip: Partial<Record<EquipSlot, number>>, items: Item[]): Look {
  const get = (s: EquipSlot) => { const uid = equip[s]; return uid === undefined ? undefined : items.find(i => i.uid === uid); };
  const out: Look = { ...look, parts: [...(look.parts ?? [])] };
  const w = get('weapon'), o = get('offhand'), h = get('helmet'), a = get('armor'), c = get('cloak');
  if (w) out.weapon = baseOf(w).model;
  if (o) out.offhand = baseOf(o).model;
  if (handsOfModel(out.weapon) === 2) out.offhand = undefined;   // 양손이면 방패를 내려놓는다
  if (h) { out.helmet = baseOf(h).model; out.parts = out.parts!.filter(p => !/Head_Hood/.test(p)); }
  if (c) out.cloak = baseOf(c).model;
  // 갑옷은 옷을 입히는 인간 몸일 때만 보인다 (엘프·오크 몸은 옷이 붙어 있어 능력치만)
  if (a && look.body.startsWith('q/head/')) {
    const sex = look.body.endsWith('Female') ? 'Female' : 'Male';
    const kind = baseOf(a).model === 'ranger' ? 'Ranger' : 'Peasant';
    out.parts = out.parts!.filter(p => !/_Body$/.test(p));
    out.parts.push(`q/part/${sex}_${kind}_Body`);
  }
  return out;
}

export const ITEM_ICON = (it: Item | ItemBase) => `icons/${('icon' in it ? it : baseOf(it)).icon}.svg`;
