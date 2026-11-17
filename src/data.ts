// 캐릭터·적·웨이브 정의. v0 는 코드 안에 두고, v1 부터 data/ JSON 으로 옮긴다.
import { Color3, Vector3 } from '@babylonjs/core';
import type { Battle } from './battle';
import type { Unit } from './unit';

export interface Stats {
  hp: number; atk: number; def: number; spd: number;
  crit: number; critDmg: number; healPow: number;
  threat: number;   // 위협 배율. 적은 위협이 높은 아군을 노린다
  range: number; move: number;
}

export interface Anims {
  idle: string; run: string; attack: string[]; hit: string; death: string;
  victory?: string; spawn?: string; extra?: string[];
}

export interface SkillDef {
  name: string; desc?: string; cd: number; anim: string; hitAt: number;
  melee?: boolean;                               // 대상이 사거리 안일 때만
  can?: (b: Battle, u: Unit) => boolean;
  run: (b: Battle, u: Unit) => void;
}

export interface UltDef {
  name: string; desc: string; cutAnim: string;
  targeted?: boolean;                            // 탭 후 적을 골라야 한다
  run: (b: Battle, u: Unit, target?: Unit) => void;
}

export type ProjKind = 'bolt' | 'gold' | 'magic' | 'dark' | 'bone';

// ───────── 등급과 외형 ─────────

export const GRADES = ['일반', '고급', '희귀', '영웅', '전설', '신화', '불멸', '초월'];
export const GRADE_COLORS = ['#b9b4a8', '#7ad27a', '#5aa9ff', '#c07cff', '#ffb43c', '#ff5a5a', '#ff7ae0', '#fff3a0'];
// 능력치 배율. 데이터의 stats 는 희귀(2) 기준이다
const GRADE_MUL = [0.75, 0.87, 1, 1.18, 1.48, 1.85, 2.37, 2.96];
export const gradeMul = (g: number) => GRADE_MUL[g];
/** 영웅의 그 등급 외형 (없으면 가장 가까운 아래 등급) */
export const lookOf = (d: UnitDef, g: number) => d.looks?.[Math.min(g, d.looks.length - 1)];

/** 한 등급의 외형. 6겹: 몸(얼굴) · 의상 파츠 · 헤어 · (장식) · 무기·보조 · 재질·이펙트 (docs/content-design.md 9장) */
export interface Look {
  body: string;               // q/head/… (옷을 입힐 인간 머리) 또는 q/body/… (옷 포함 몸)
  parts?: string[];           // q/part/…
  hair?: string[];            // q/hair/…
  weapon?: string;            // q/weapon/… 오른손
  offhand?: string;           // q/weapon/… 왼손 (방패는 한손 무기일 때만)
  tint?: [number, number, number];   // 의상 색 곱
  glow?: [number, number, number];   // 무기 발광
  aura?: [number, number, number];   // 발밑 오라
  scale?: number;
}

export interface UnitDef {
  id: string; name: string; title?: string;
  archetype?: string;                            // 설계 의도 (화면에는 안 보인다)
  model: string; scale?: number; boss?: boolean;    // model 'q' = 조합형(looks 사용)
  maxGrade?: number; startGrade?: number;            // 영웅: 오를 수 있는 최대 등급, 처음 등급
  titles?: string[]; looks?: Look[];                 // 등급별 칭호·외형 (0 ~ maxGrade)
  keep?: string[];                               // 모델에 붙은 무기 중 남길 것
  attach?: { mesh: string; slot: string }[];     // 따로 붙일 무기
  stats: Stats; anims: Anims;
  hitAt: number;                                 // 기본 공격이 맞는 시점(초)
  projectile?: ProjKind;
  targeting: 'nearest' | 'threat' | 'lowest';
  skills: SkillDef[]; ult?: UltDef;
  rage?: number;                                 // 잃은 HP 비율만큼 공격력 증가(최대값)
  color: string;
}

export const COL = {
  gold: new Color3(1, 0.78, 0.32),
  red: new Color3(1, 0.22, 0.12),
  green: new Color3(0.35, 1, 0.5),
  blue: new Color3(0.45, 0.72, 1),
  purple: new Color3(0.72, 0.35, 1),
  white: new Color3(1, 1, 1),
  bone: new Color3(0.95, 0.88, 0.7),
};

const lowestHpRatio = (list: Unit[]) =>
  list.reduce<Unit | null>((m, x) => (!m || x.hp / x.maxHp < m.hp / m.maxHp ? x : m), null);

const QS = 1.25;   // 조합형 사람 키(약 1.8)를 KayKit 적(약 2.3)과 맞춘다

export const HEROES: UnitDef[] = [
  {
    id: 'leon', name: '레온', title: '서약의 기사', archetype: '딜탱 유도형', color: '#e8b64c',
    model: 'q', scale: QS, maxGrade: 7, startGrade: 2,
    titles: ['종자', '견습 기사', '기사', '정예 기사', '기사단장', '성기사', '수호성', '용기사'],
    looks: [
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Peasant_Body', 'q/part/Male_Peasant_Arms', 'q/part/Male_Peasant_Legs', 'q/part/Male_Peasant_Feet'], weapon: 'q/weapon/Short_Sword_01', offhand: 'q/weapon/kk_shield_A' },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Peasant_Body', 'q/part/Male_Peasant_Arms', 'q/part/Male_Peasant_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_01', offhand: 'q/weapon/kk_shield_A' },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_03', offhand: 'q/weapon/kk_shield_B', tint: [0.75, 0.8, 0.95] },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_05', offhand: 'q/weapon/kk_shield_B', tint: [0.55, 0.6, 0.85] },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_07', offhand: 'q/weapon/kk_shield_C', tint: [1, 0.85, 0.5], glow: [1, 0.75, 0.3], scale: 1.03 },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_07', offhand: 'q/weapon/kk_shield_C', tint: [1, 0.95, 0.8], glow: [1, 0.85, 0.4], aura: [1, 0.8, 0.35], scale: 1.05 },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/kk_sword_E', offhand: 'q/weapon/kk_shield_C', tint: [1.1, 1.05, 0.9], glow: [1, 0.95, 0.6], aura: [1, 0.95, 0.6], scale: 1.07 },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/kk_sword_E', offhand: 'q/weapon/kk_shield_C', tint: [0.9, 0.5, 0.45], glow: [1, 0.45, 0.2], aura: [1, 0.4, 0.2], scale: 1.08 },
    ],
    stats: { hp: 1500, atk: 92, def: 60, spd: 100, crit: 0.08, critDmg: 1.6, healPow: 1, threat: 2.6, range: 1.6, move: 3.6 },
    anims: {
      idle: 'Idle_Shield_Loop', run: 'Jog_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01', victory: 'Yes',
      attack: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'],
      extra: ['Shield_OneShot', 'Sword_Block'],
    },
    hitAt: 0.38, targeting: 'nearest', rage: 0.4,
    skills: [
      {
        name: '방패 강타', desc: '공격력 140% 피해, 1.2초 기절, 위협 크게 증가', cd: 7, anim: 'Shield_OneShot', hitAt: 0.35, melee: true,
        run: (b, u) => {
          const t = u.target; if (!t) return;
          b.damage(u, t, 1.4);
          b.stun(t, 1.2);
          u.threat += 400;
          b.fx.ring(t.pos, COL.gold, 1.8, 0.4);
        },
      },
      {
        name: '굳건한 의지', desc: 'HP 80% 아래일 때 6초간 받는 피해 35% 감소, 최대 HP 8% 보호막', cd: 12, anim: 'Sword_Block', hitAt: 0.2,
        can: (_b, u) => u.hp / u.maxHp < 0.8,
        run: (b, u) => {
          b.addDr(u, 0.35, 6);
          b.addShield(u, u.maxHp * 0.08);
          b.fx.bubble(u, COL.gold, 6);
        },
      },
    ],
    ult: {
      name: '수호의 맹세', desc: '적 전체 도발 6초 · 아군 전체 보호막', cutAnim: 'Sword_Block',
      run: (b, u) => {
        u.play('Idle_Shield_Loop', true);
        u.busyUntil = b.time + 1.2;
        b.fx.ring(u.pos, COL.gold, 9, 0.9);
        b.shake(0.25);
        for (const e of b.foesOf(u)) b.taunt(e, u, 6);
        b.addDr(u, 0.3, 6);
        for (const a of b.alliesOf(u)) {
          b.addShield(a, u.maxHp * 0.15);
          b.fx.bubble(a, COL.gold, 6);
        }
      },
    },
  },
  {
    id: 'bran', name: '브란', title: '북방의 도끼', archetype: '퓨어딜러', color: '#e0583a',
    model: 'q', scale: QS, maxGrade: 4, startGrade: 1,
    titles: ['떠돌이 전사', '투사', '광전사', '전쟁 군주', '피의 군주'],
    looks: [
      { body: 'q/body/Orc_Male', weapon: 'q/weapon/Axe_01' },
      { body: 'q/body/Orc_Male', weapon: 'q/weapon/Axe_03' },
      { body: 'q/body/Orc_Male', parts: ['q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Axe_05', tint: [0.85, 0.75, 0.7] },
      { body: 'q/body/Orc_Male', parts: ['q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Hammer_07', tint: [0.7, 0.55, 0.5], scale: 1.04 },
      { body: 'q/body/Orc_Male', parts: ['q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/kk_axe_C', tint: [0.8, 0.45, 0.4], glow: [1, 0.25, 0.15], aura: [1, 0.2, 0.1], scale: 1.08 },
    ],
    stats: { hp: 1200, atk: 150, def: 35, spd: 95, crit: 0.25, critDmg: 1.8, healPow: 0.8, threat: 1.2, range: 1.8, move: 3.8 },
    anims: {
      idle: 'Sword_Idle', run: 'Jog_Fwd_Loop', hit: 'Hit_Knockback', death: 'Death01', victory: 'Yes',
      attack: ['Sword_Attack', 'Sword_Regular_C'],
      extra: ['Sword_Heavy_Combo', 'Sword_Regular_Combo'],
    },
    hitAt: 0.45, targeting: 'nearest',
    skills: [
      {
        name: '대지 가르기', desc: '대상에게 공격력 220%, 주변 적에게 90% 피해', cd: 8, anim: 'Sword_Heavy_Combo', hitAt: 0.6, melee: true,
        run: (b, u) => {
          const t = u.target; if (!t) return;
          b.damage(u, t, 2.2);
          for (const e of b.near(u.pos, b.foesOf(u), 2.8)) if (e !== t) b.damage(u, e, 0.9);
          b.fx.ring(u.pos, COL.red, 3, 0.35);
        },
      },
    ],
    ult: {
      name: '피의 회오리', desc: '2.4초 동안 주변 적에게 6연타 · 피해의 30% 흡혈', cutAnim: 'Sword_Heavy_Combo',
      run: (b, u) => {
        u.play('Sword_Regular_Combo', true, 1.3);
        u.busyUntil = b.time + 2.4;
        for (let i = 0; i < 6; i++) {
          b.after(0.2 + i * 0.4, () => {
            if (!u.alive) return;
            b.fx.ring(u.pos, COL.red, 3.6, 0.3);
            for (const e of b.near(u.pos, b.foesOf(u), 3.6)) b.damage(u, e, 0.85, { lifesteal: 0.3, noGauge: true });
          });
        }
      },
    },
  },
  {
    id: 'sera', name: '세라', title: '새벽의 사제', archetype: '딜힐', color: '#7fb8ff',
    model: 'q', scale: QS, maxGrade: 5, startGrade: 2,
    titles: ['견습 마법사', '수습 마법사', '마법사', '상급 마법사', '대마법사', '현자'],
    looks: [
      { body: 'q/head/Human_Female', hair: ['q/hair/Hair_Buns', 'q/hair/Eyebrows_Female'], parts: ['q/part/Female_Peasant_Body', 'q/part/Female_Peasant_Arms', 'q/part/Female_Peasant_Legs', 'q/part/Female_Peasant_Feet'], weapon: 'q/weapon/kk_wand_A' },
      { body: 'q/head/Human_Female', hair: ['q/hair/Hair_Buns', 'q/hair/Eyebrows_Female'], parts: ['q/part/Female_Peasant_Body', 'q/part/Female_Peasant_Arms', 'q/part/Female_Peasant_Legs', 'q/part/Female_Ranger_Feet'], weapon: 'q/weapon/kk_staff_A', tint: [0.75, 0.8, 1] },
      { body: 'q/head/Human_Female', hair: ['q/hair/Hair_Long', 'q/hair/Eyebrows_Female'], parts: ['q/part/Female_Ranger_Body', 'q/part/Female_Ranger_Arms', 'q/part/Female_Peasant_Legs', 'q/part/Female_Ranger_Feet', 'q/part/Female_Ranger_Head_Hood'], weapon: 'q/weapon/kk_staff_A', tint: [0.6, 0.65, 1] },
      { body: 'q/head/Human_Female', hair: ['q/hair/Hair_Long', 'q/hair/Eyebrows_Female'], parts: ['q/part/Female_Ranger_Body', 'q/part/Female_Ranger_Arms', 'q/part/Female_Ranger_Legs', 'q/part/Female_Ranger_Feet', 'q/part/Female_Ranger_Acc_Pauldrons', 'q/part/Female_Ranger_Head_Hood'], weapon: 'q/weapon/kk_staff_B', tint: [0.55, 0.5, 0.95] },
      { body: 'q/head/Human_Female', hair: ['q/hair/Hair_Long', 'q/hair/Eyebrows_Female'], parts: ['q/part/Female_Ranger_Body', 'q/part/Female_Ranger_Arms', 'q/part/Female_Ranger_Legs', 'q/part/Female_Ranger_Feet', 'q/part/Female_Ranger_Acc_Pauldrons'], weapon: 'q/weapon/kk_staff_B', tint: [0.95, 0.95, 1.1], glow: [0.5, 0.75, 1], scale: 1.03 },
      { body: 'q/head/Human_Female', hair: ['q/hair/Hair_Long', 'q/hair/Eyebrows_Female'], parts: ['q/part/Female_Ranger_Body', 'q/part/Female_Ranger_Arms', 'q/part/Female_Ranger_Legs', 'q/part/Female_Ranger_Feet', 'q/part/Female_Ranger_Acc_Pauldrons'], weapon: 'q/weapon/kk_staff_B', tint: [1.1, 1.05, 0.85], glow: [1, 0.9, 0.5], aura: [0.6, 0.85, 1], scale: 1.05 },
    ],
    stats: { hp: 900, atk: 120, def: 25, spd: 105, crit: 0.1, critDmg: 1.6, healPow: 1.25, threat: 0.8, range: 9, move: 3.2 },
    anims: {
      idle: 'Spell_Simple_Idle_Loop', run: 'Jog_Fwd_Loop', hit: 'Hit_Head', death: 'Death01', victory: 'Yes',
      attack: ['Spell_Simple_Shoot'], extra: ['Spell_Simple_Enter'],
    },
    hitAt: 0.35, projectile: 'magic', targeting: 'nearest',
    skills: [
      {
        name: '치유의 빛', desc: 'HP 비율이 가장 낮은 아군을 공격력 190% 만큼 치유', cd: 4.5, anim: 'Spell_Simple_Enter', hitAt: 0.45,
        can: (b, u) => b.alliesOf(u).some(a => a.hp / a.maxHp < 0.72),
        run: (b, u) => {
          const t = lowestHpRatio(b.alliesOf(u)); if (!t) return;
          b.heal(u, t, 1.9);
        },
      },
    ],
    ult: {
      name: '성광 폭발', desc: '적 전체 피해 · 아군 전체 치유', cutAnim: 'Spell_Simple_Idle_Loop',
      run: (b, u) => {
        u.play('Spell_Simple_Shoot', false);
        u.busyUntil = b.time + 0.9;
        for (const e of b.foesOf(u)) {
          b.fx.pillar(e.pos, COL.gold, 0.9);
          b.after(0.35, () => b.damage(u, e, 1.5, { noGauge: true }));
        }
        b.after(0.5, () => { for (const a of b.alliesOf(u)) b.heal(u, a, 1.2); });
        b.shake(0.2);
      },
    },
  },
  {
    id: 'kyle', name: '카일', title: '그림자 사수', archetype: '원거리 퓨어딜러', color: '#9be27a',
    model: 'q', scale: QS, maxGrade: 6, startGrade: 2,
    titles: ['사냥꾼 견습', '사냥꾼', '정찰병', '명사수', '그림자 사수', '바람의 사수', '별빛 사수'],
    looks: [
      { body: 'q/body/Elf_Male', weapon: 'q/weapon/kk_bow_A_withString' },
      { body: 'q/body/Elf_Male', parts: ['q/part/Male_Ranger_Feet_Boots'], weapon: 'q/weapon/kk_bow_A_withString' },
      { body: 'q/body/Elf_Male', parts: ['q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Head_Hood'], weapon: 'q/weapon/kk_bow_B_withString', tint: [0.75, 0.9, 0.75] },
      { body: 'q/body/Elf_Male', parts: ['q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Head_Hood', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/kk_bow_B_withString', tint: [0.55, 0.75, 0.55] },
      { body: 'q/body/Elf_Male', parts: ['q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Head_Hood', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/kk_bow_B_withString', tint: [0.4, 0.42, 0.5], glow: [0.6, 0.4, 1], scale: 1.03 },
      { body: 'q/body/Elf_Male', parts: ['q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/kk_bow_B_withString', tint: [0.75, 0.95, 0.85], glow: [0.5, 1, 0.8], aura: [0.5, 1, 0.8], scale: 1.05 },
      { body: 'q/body/Elf_Male', parts: ['q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/kk_bow_B_withString', tint: [0.85, 0.85, 1.15], glow: [0.75, 0.8, 1], aura: [0.7, 0.75, 1], scale: 1.07 },
    ],
    stats: { hp: 950, atk: 140, def: 28, spd: 120, crit: 0.3, critDmg: 2.0, healPow: 1, threat: 0.7, range: 10, move: 3.6 },
    anims: {
      idle: 'Pistol_Idle_Loop', run: 'Jog_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01', victory: 'Yes',
      attack: ['Pistol_Shoot'], extra: ['Pistol_Aim_Neutral'],
    },
    hitAt: 0.25, projectile: 'bolt', targeting: 'nearest',
    skills: [
      {
        name: '약점 사격', desc: 'HP 비율이 가장 낮은 적에게 확정 치명 220% 피해', cd: 7, anim: 'Pistol_Shoot', hitAt: 0.25,
        run: (b, u) => {
          const t = lowestHpRatio(b.foesOf(u)); if (!t) return;
          u.faceNow(t.pos);
          b.shoot(u, t, 'gold', () => b.damage(u, t, 2.2, { crit: true }));
        },
      },
    ],
    ult: {
      name: '사신의 표식', desc: '고른 적 하나에게 확정 치명 6.5배 · 처치하면 게이지 50% 반환', cutAnim: 'Pistol_Aim_Neutral', targeted: true,
      run: (b, u, t) => {
        if (!t || !t.alive) return;
        u.faceNow(t.pos);
        u.play('Pistol_Shoot', false);
        u.busyUntil = b.time + 0.7;
        b.fx.ring(t.pos, COL.red, 2.2, 0.5);
        b.after(0.2, () => b.shoot(u, t, 'gold', () => {
          b.damage(u, t, 6.5, { crit: true, noGauge: true });
          b.shake(0.3);
          b.hud.flash('rgba(255,220,140,.35)');
          if (!t.alive) u.gauge = 50;
        }, 2.2, 34));
      },
    },
  },
];

const SKEL_ANIMS = (attack: string[], idle = 'Idle_Combat'): Anims => ({
  idle, run: 'Walking_D_Skeletons', attack, hit: 'Hit_A', death: 'Death_C_Skeletons', spawn: 'Spawn_Ground_Skeletons',
});

export const ENEMIES: Record<string, UnitDef> = {
  minion: {
    id: 'minion', name: '해골 병사', model: 'Skeleton_Minion', color: '#ccc',
    attach: [{ mesh: 'Skeleton_Blade', slot: 'handslot.r' }],
    stats: { hp: 760, atk: 80, def: 15, spd: 95, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 1, range: 1.5, move: 2.4 },
    anims: SKEL_ANIMS(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']),
    hitAt: 0.4, targeting: 'threat', skills: [],
  },
  warrior: {
    id: 'warrior', name: '해골 전사', model: 'Skeleton_Warrior', color: '#ccc',
    attach: [{ mesh: 'Skeleton_Axe', slot: 'handslot.r' }, { mesh: 'Skeleton_Shield_Small_A', slot: 'handslot.l' }],
    stats: { hp: 1400, atk: 100, def: 40, spd: 85, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 1, range: 1.6, move: 2.2 },
    anims: SKEL_ANIMS(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal']),
    hitAt: 0.45, targeting: 'threat', skills: [],
  },
  rogue: {
    id: 'rogue', name: '해골 궁수', model: 'Skeleton_Rogue', color: '#ccc',
    attach: [{ mesh: 'Skeleton_Crossbow', slot: 'handslot.r' }],
    stats: { hp: 700, atk: 90, def: 12, spd: 95, crit: 0.1, critDmg: 1.5, healPow: 1, threat: 1, range: 9, move: 2.4 },
    anims: SKEL_ANIMS(['1H_Ranged_Shoot'], 'Idle_B'),
    hitAt: 0.3, projectile: 'bone', targeting: 'threat', skills: [],
  },
  mage: {
    id: 'mage', name: '해골 술사', model: 'Skeleton_Mage', color: '#ccc',
    attach: [{ mesh: 'Skeleton_Staff', slot: 'handslot.r' }],
    stats: { hp: 800, atk: 110, def: 14, spd: 85, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 1, range: 8, move: 2.2 },
    anims: SKEL_ANIMS(['Spellcast_Shoot'], 'Idle_B'),
    hitAt: 0.35, projectile: 'dark', targeting: 'threat', skills: [],
  },
  boss: {
    id: 'boss', name: '해골 군주 바르크', model: 'Skeleton_Warrior', scale: 1.8, boss: true, color: '#c44',
    attach: [{ mesh: 'Skeleton_Axe', slot: 'handslot.r' }, { mesh: 'Skeleton_Shield_Large_A', slot: 'handslot.l' }],
    stats: { hp: 13000, atk: 150, def: 50, spd: 80, crit: 0.08, critDmg: 1.6, healPow: 1, threat: 1, range: 2.4, move: 2.0 },
    anims: { ...SKEL_ANIMS(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']), extra: ['Taunt', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'] },
    hitAt: 0.45, targeting: 'threat',
    skills: [
      {
        name: '휩쓸기', cd: 9, anim: '2H_Melee_Attack_Spin', hitAt: 0.5, melee: true,
        run: (b, u) => {
          b.fx.ring(u.pos, COL.red, 4, 0.4);
          for (const h of b.near(u.pos, b.foesOf(u), 4)) b.damage(u, h, 1.1);
        },
      },
    ],
    ult: {
      name: '대지 분쇄', desc: '', cutAnim: 'Taunt',
      run: (b, u) => {
        const t = u.target ?? b.foesOf(u)[0]; if (!t) return;
        const at = t.pos.clone();
        u.faceNow(at);
        u.play('Taunt', false);
        u.busyUntil = b.time + 2.4;
        b.hud.banner('대지 분쇄', '바르크가 땅을 내려칩니다', true);
        b.fx.telegraph(at, 4.2, 1.7);
        b.after(1.2, () => { if (u.alive) u.play('1H_Melee_Attack_Jump_Chop', false); });
        b.after(1.7, () => {
          if (!u.alive) return;
          b.fx.ring(at, COL.red, 5.5, 0.5);
          b.fx.burst(at.add(new Vector3(0, 0.3, 0)), COL.bone, 40, 7, 0.3);
          b.shake(0.6);
          for (const h of b.near(at, b.foesOf(u), 4.2)) b.damage(u, h, 1.8, { noGauge: true });
        });
      },
    },
  },
};

type Spawn = [kind: string, x: number, z: number];
export interface Wave { boss?: boolean; units: Spawn[] }

const W_SKEL: Wave = { units: [['minion', -2, 6], ['minion', 2, 6], ['minion', 0, 7.5], ['rogue', 0, 10.5]] };
const W_GUARD: Wave = { units: [['warrior', -1.6, 6], ['warrior', 1.6, 6], ['minion', -3.2, 7.5], ['mage', -1.6, 10.5], ['rogue', 1.6, 10.5]] };
const W_BOSS: Wave = { boss: true, units: [['boss', 0, 8], ['minion', -2.6, 6], ['minion', 2.6, 6], ['mage', -3.4, 11], ['mage', 3.4, 11]] };

export interface Stage {
  id: string; name: string;
  level: number;                                 // 적 능력치 배율에 쓴다 (enemyMul)
  waves: Wave[];
  reward: { gold: number; gems: number };        // gems 는 첫 클리어 때만
}

export const CHAPTER = '1장 · 해골 군주의 무덤';
export const STAGES: Stage[] = [
  { id: '1-1', name: '무너진 입구', level: 1, waves: [W_SKEL], reward: { gold: 300, gems: 150 } },
  { id: '1-2', name: '뼈의 회랑', level: 2, waves: [W_SKEL, W_GUARD], reward: { gold: 500, gems: 150 } },
  { id: '1-3', name: '군주의 방', level: 4, waves: [W_SKEL, W_GUARD, W_BOSS], reward: { gold: 900, gems: 300 } },
];

// 레벨에 따른 능력치 배율 (HP·공격·방어에 곱한다)
export const heroMul = (lv: number) => 1 + 0.08 * (lv - 1);
export const enemyMul = (lv: number) => 1 + 0.1 * (lv - 1);

// 레벨업: 골드만 쓴다. 등급별 최대 레벨은 뽑기 단계에서 붙인다
export const MAX_LEVEL = 40;
export const levelCost = (lv: number) => Math.round(100 * Math.pow(1.15, lv - 1));   // lv → lv+1

/** 전투력: 화면에 보여 주는 대략의 세기 */
export const power = (d: UnitDef, lv: number, grade = 2) => {
  const st = d.stats, m = heroMul(lv) * gradeMul(grade);
  return Math.round((st.hp * 0.1 + st.atk * 2 * (1 + st.crit * (st.critDmg - 1)) + st.def * 1.5) * m * (st.spd / 100));
};

// 영웅 진형 (z+ 가 적 쪽). 카메라에서 보면 +x 가 왼쪽이다
export const FORMATION = [
  new Vector3(1.1, 0, -1),    // 앞줄 왼쪽
  new Vector3(-1.1, 0, -1),   // 앞줄 오른쪽
  new Vector3(1.5, 0, -3.8),  // 뒷줄 왼쪽
  new Vector3(-1.5, 0, -3.8), // 뒷줄 오른쪽
];

// 모델별로 쓰는 애니메이션만 남기려고 모은다 (복제 비용 절감)
export function animsByModel(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const defs = [...HEROES, ...Object.values(ENEMIES)];
  for (const d of defs) {
    const s = m.get(d.model) ?? new Set<string>();
    const a = d.anims;
    [a.idle, a.run, a.hit, a.death, a.victory, a.spawn, ...a.attack, ...(a.extra ?? [])].forEach(n => n && s.add(n));
    d.skills.forEach(k => s.add(k.anim));
    if (d.ult) s.add(d.ult.cutAnim);
    m.set(d.model, s);
  }
  return m;
}
