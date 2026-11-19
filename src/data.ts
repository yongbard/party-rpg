// 캐릭터·적·웨이브 정의. v0 는 코드 안에 두고, v1 부터 data/ JSON 으로 옮긴다.
import { Vector3 } from '@babylonjs/core';
import { COL, lowestHpRatio, QS } from './common';
import { ENEMIES } from './enemies';
import { MORE_HEROES } from './heroes';
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
  helmet?: string;            // q/gear/… 머리 뼈에 고정 (쓰면 머리카락은 눈썹만 남긴다)
  cloak?: string;             // q/gear/… 가슴 뼈에 고정
  acc?: string[];             // 장식: q/acc/… 뼈에 고정하는 소품, fx:halo·wings·orbs·horns 코드로 만드는 빛 장식 (heroModel.ts ACC_FIT)
  tint?: [number, number, number];   // 의상 색 곱
  skin?: [number, number, number];   // 몸(피부) 색 곱 (적: 좀비·임프 등)
  glow?: [number, number, number];   // 무기 발광
  aura?: [number, number, number];   // 발밑 오라
  scale?: number;
}

export interface UnitDef {
  id: string; name: string; title?: string;
  archetype?: string;                            // 설계 의도 (화면에는 안 보인다)
  model: string; scale?: number; boss?: boolean;    // model 'q' = 조합형(looks 사용), 'um/…' = Ultimate Monsters 통짜 모델
  fit?: number;                                      // um 모델 원래 크기에 곱하는 배율 (키 약 2 가 되게)
  eyeGlow?: [number, number, number];                // um 모델 눈을 이 색으로 빛나게 (귀여운 눈을 무섭게)
  maxGrade?: number; startGrade?: number;            // 영웅: 오를 수 있는 최대 등급, 처음 등급
  titles?: string[]; looks?: Look[];                 // 등급별 칭호·외형 (0 ~ maxGrade)
  stats: Stats; anims: Anims;
  hitAt: number;                                 // 기본 공격이 맞는 시점(초)
  projectile?: ProjKind;
  targeting: 'nearest' | 'threat' | 'lowest';
  skills: SkillDef[]; ult?: UltDef;
  rage?: number;                                 // 잃은 HP 비율만큼 공격력 증가(최대값)
  color: string;
}

export { COL, ENEMIES };

// 처음 4명은 여기, 3-5 에서 늘린 영웅은 heroes.ts
export const HEROES: UnitDef[] = [
  {
    id: 'leon', name: '레온', title: '서약의 기사', archetype: '딜탱 유도형', color: '#e8b64c',
    model: 'q', scale: QS, maxGrade: 7, startGrade: 2,
    titles: ['종자', '견습 기사', '기사', '정예 기사', '기사단장', '성기사', '수호성', '용기사'],
    looks: [
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Peasant_Body', 'q/part/Male_Peasant_Arms', 'q/part/Male_Peasant_Legs', 'q/part/Male_Peasant_Feet'], weapon: 'q/weapon/Short_Sword_01', offhand: 'q/weapon/kk_shield_A' },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Peasant_Body', 'q/part/Male_Peasant_Arms', 'q/part/Male_Peasant_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_01', offhand: 'q/weapon/kk_shield_A' },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_03', offhand: 'q/weapon/kk_shield_B', tint: [0.75, 0.8, 0.95] },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_05', cloak: 'q/gear/Knight_Cape', offhand: 'q/weapon/kk_shield_B', tint: [0.55, 0.6, 0.85] },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_07', cloak: 'q/gear/Knight_Cape', offhand: 'q/weapon/kk_shield_C', tint: [1, 0.85, 0.5], glow: [1, 0.75, 0.3], scale: 1.03 },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/Long_Sword_07', cloak: 'q/gear/Knight_Cape', offhand: 'q/weapon/kk_shield_C', tint: [1, 0.95, 0.8], glow: [1, 0.85, 0.4], aura: [1, 0.8, 0.35], scale: 1.05 },
      { body: 'q/head/Human_Male', hair: ['q/hair/Hair_SimpleParted', 'q/hair/Eyebrows_Regular'], parts: ['q/part/Male_Ranger_Body', 'q/part/Male_Ranger_Arms', 'q/part/Male_Ranger_Legs', 'q/part/Male_Ranger_Feet_Boots', 'q/part/Male_Ranger_Acc_Pauldron'], weapon: 'q/weapon/kk_sword_E', cloak: 'q/gear/Knight_Cape', offhand: 'q/weapon/kk_shield_C', tint: [1.1, 1.05, 0.9], glow: [1, 0.95, 0.6], aura: [1, 0.95, 0.6], scale: 1.07 },
      // 초월: 용으로 변한다 (Tripo 로 만든 몸에 영웅 뼈대를 심음, docs/credits.md)
      { body: 'q/body/TripoDragon', weapon: 'q/weapon/kk_sword_E', offhand: 'q/weapon/kk_shield_C', glow: [1, 0.45, 0.2], aura: [1, 0.4, 0.2] },
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
  ...MORE_HEROES,
];

// 7단계 변신형: 최고 등급은 몸 자체가 바뀐다 (Tripo 로 만든 통짜 몸에 영웅 뼈대를 심음, src/tools/blender_rig.py, docs/credits.md)
// 무기·발광·오라는 그 등급 것을 그대로 쓰고, 옷 파츠·머리·투구·망토·색조·크기는 뺀다 (키는 몸 파일이 정한다)
const TRANSFORM: Record<string, string> = {
  kyle: 'q/body/TripoStarArcher',   // 별빛 사수
  garsh: 'q/body/TripoEarthTitan',  // 불멸의 대족장
  morgan: 'q/body/TripoLich',       // 죽음의 현자
  sera: 'q/body/TripoSage',         // 현자
};
for (const h of HEROES) {
  const body = TRANSFORM[h.id];
  if (!body || !h.looks) continue;
  const top = h.looks[h.looks.length - 1];
  h.looks[h.looks.length - 1] = { body, weapon: top.weapon, offhand: top.offhand, glow: top.glow, aura: top.aura };
}

// 7단계 외형: 등급마다 실루엣이 바뀌게 장식을 더한다 (그 등급부터 계속 단다). q/acc 는 뼈에 붙이는 소품, fx: 는 코드로 만드는 빛 장식 (heroModel.ts)
// AI 변신형 몸(q/body/Tripo…)에는 달지 않는다
const ACC_STEPS: Record<string, Record<number, string[]>> = {
  leon: { 4: ['q/acc/Armor_Metal'], 5: ['fx:halo'], 6: ['fx:wings'] },
  bran: { 1: ['q/acc/Necklace3'], 3: ['q/acc/Armor_Leather'], 4: ['fx:horns', 'q/acc/Skull'] },
  sera: { 4: ['q/acc/Necklace1'], 5: ['fx:halo', 'fx:orbs'] },
  kyle: { 1: ['q/acc/Quiver'], 4: ['q/acc/Armor_Leather'], 5: ['fx:wings'], 6: ['fx:orbs'] },
  mia: { 2: ['q/acc/Bag'] },
  pug: { 1: ['q/acc/Bag'] },
  hagen: { 3: ['q/acc/Armor_Metal'] },
  lia: { 3: ['q/acc/Necklace3'] },
  gorga: { 2: ['q/acc/Necklace3'], 3: ['q/acc/Skull', 'fx:orbs'] },
  kix: { 3: ['fx:horns'] },
  jin: { 1: ['q/acc/Necklace1'], 4: ['fx:orbs'] },
  nora: { 4: ['fx:wings'] },
  ella: { 3: ['q/acc/Necklace1'], 4: ['fx:orbs'] },
  morgan: { 4: ['q/acc/Skull', 'q/acc/Necklace3'], 5: ['fx:orbs', 'fx:halo'] },
  garsh: { 4: ['q/acc/Armor_Golden'], 5: ['fx:orbs'], 6: ['fx:horns', 'q/acc/Necklace3'] },
};
for (const h of HEROES) {
  const steps = ACC_STEPS[h.id];
  if (!steps || !h.looks) continue;
  let cur: string[] = [];
  h.looks = h.looks.map((l, g) => {
    cur = [...cur, ...(steps[g] ?? [])];
    return cur.length && !l.body.startsWith('q/body/Tripo') ? { ...l, acc: [...(l.acc ?? []), ...cur] } : l;
  });
}

/** 바로 앞 등급과 모양(몸·파츠·헤어·무기·투구·망토·장식)이 같은 등급: 색·빛만 바뀐다 (poc.html?check 로 본다) */
export function colorOnlyGrades() {
  const shape = (l: Look) => JSON.stringify([l.body, l.parts, l.hair, l.weapon, l.offhand, l.helmet, l.cloak, l.acc]);
  return HEROES.flatMap(h => (h.looks ?? []).flatMap((l, g) => (g > 0 && shape(l) === shape(h.looks![g - 1]) ? [`${h.name} ${GRADES[g]}`] : [])));
}

type Spawn = [kind: string, x: number, z: number];
export interface Wave { boss?: boolean; units: Spawn[] }

// 1장 · 망자의 무덤
const W1_SMALL: Wave = { units: [['zombie', -1.6, 6], ['zombie', 1.6, 6], ['zombie_f', 0, 7.5]] };
const W1_DEAD: Wave = { units: [['zombie', -2, 6], ['zombie', 2, 6], ['zombie_f', 0, 7.5], ['hunter', 0, 10.5]] };
const W1_GRAVE: Wave = { units: [['gravedigger', -1.6, 6], ['gravedigger', 1.6, 6], ['zombie', -3.4, 7.5], ['zombie', 3.4, 7.5], ['hunter', 0, 10.5]] };
const W1_HORDE: Wave = { units: [['zombie', -3, 6], ['zombie', -1, 6], ['zombie', 1, 6], ['zombie', 3, 6], ['zombie_f', -2, 7.5], ['zombie_f', 2, 7.5]] };
const W1_CULT: Wave = { units: [['gravedigger', -1.6, 6], ['cultist', 1.6, 6], ['zombie_f', -3.2, 7.5], ['acolyte', -1.6, 10.5], ['hunter', 1.6, 10.5]] };
const W1_RITUAL: Wave = { units: [['cultist', -1.6, 6], ['cultist', 1.6, 6], ['zombie_f', 0, 7.5], ['acolyte', -2, 10.5], ['acolyte', 2, 10.5]] };
const W1_ARCH: Wave = { units: [['gravedigger', -1.2, 6], ['cultist', 1.2, 6], ['hunter', -2.8, 10.5], ['hunter', 0, 11], ['hunter', 2.8, 10.5]] };
const W1_BOSS: Wave = { boss: true, units: [['lich', 0, 8], ['zombie', -2.6, 6], ['zombie', 2.6, 6], ['acolyte', -3.4, 11], ['hunter', 3.4, 11]] };
// 2장 · 불타는 고블린 굴
const W2_SMALL: Wave = { units: [['goblin', -2, 6], ['goblin', 2, 6], ['goblin', 0, 7.5], ['orc_spear', 0, 10.5]] };
const W2_GOB: Wave = { units: [['goblin', -2, 6], ['goblin', 2, 6], ['goblin', 0, 7.5], ['goblin_shaman', -1.5, 10.5], ['orc_spear', 1.5, 10.5]] };
const W2_PACK: Wave = { units: [['goblin', -3, 6], ['goblin', -1, 6], ['goblin', 1, 6], ['goblin', 3, 6], ['orc_spear', -1.5, 10.5], ['orc_spear', 1.5, 10.5]] };
const W2_IMPS: Wave = { units: [['imp', -3, 6.5], ['imp', 0, 6], ['imp', 3, 6.5], ['goblin_shaman', -1.6, 10.5], ['goblin_shaman', 1.6, 10.5]] };
const W2_ORC: Wave = { units: [['orc', -1.6, 6], ['orc', 1.6, 6], ['imp', -3.4, 7.5], ['imp', 3.4, 7.5], ['goblin_shaman', 0, 10.5]] };
const W2_WAR: Wave = { units: [['orc', -1.6, 6], ['orc', 1.6, 6], ['goblin', 0, 7.5], ['orc_spear', -2, 10.5], ['orc_spear', 2, 10.5]] };
const W2_RAID: Wave = { units: [['orc', 0, 6], ['goblin', -2.4, 6.5], ['imp', 2.4, 6.5], ['orc_spear', -1.8, 10.5], ['orc_spear', 1.8, 10.5], ['goblin_shaman', 0, 11.5]] };
const W2_BOSS: Wave = { boss: true, units: [['demon', 0, 8.5], ['imp', -2.6, 6], ['imp', 2.6, 6], ['goblin_shaman', -3.4, 11], ['orc_spear', 3.4, 11]] };

/** 별 조건. 첫째는 늘 클리어 */
export type Cond = { k: 'clear' } | { k: 'nodeath' } | { k: 'time'; n: number } | { k: 'hp'; n: number } | { k: 'ult'; n: number } | { k: 'size'; n: number };
/** 전투가 끝난 뒤 별 조건을 따질 기록 */
export interface Outcome { win: boolean; deaths: number; time: number; hpPct: number; ults: number; size: number }
export const condText = (c: Cond) =>
  c.k === 'clear' ? '클리어' : c.k === 'nodeath' ? '아무도 쓰러지지 않기' : c.k === 'time' ? `${c.n}초 안에 클리어`
    : c.k === 'hp' ? `파티 체력 ${c.n}% 이상 남기기` : c.k === 'ult' ? (c.n ? `필살기 ${c.n}번 이하` : '필살기 쓰지 않기') : `${c.n}명 이하로 출전`;
export function condMet(c: Cond, o: Outcome) {
  if (!o.win) return false;
  switch (c.k) {
    case 'clear': return true;
    case 'nodeath': return o.deaths === 0;
    case 'time': return o.time <= c.n;
    case 'hp': return o.hpPct * 100 >= c.n;
    case 'ult': return o.ults <= c.n;
    case 'size': return o.size <= c.n;
  }
}

export interface Stage {
  id: string; name: string;
  level: number;                                 // 적 능력치 배율에 쓴다 (enemyMul)
  waves: Wave[];
  reward: { gold: number; gems: number };        // gems 는 별 3개를 다 얻을 때의 합 (별 하나에 1/3). 다시 깨면 1/10 (repeatGems)
  conds: Cond[];                                 // 별 조건 3개 (요일 던전·탑·레이드는 비운다)
  limit?: number;                                // 제한 시간(초). 다 되면 그때까지로 끝 (레이드)
}

/** 장 이름. 스테이지 id 의 앞 숫자가 장 번호다 ('2-1' → CHAPTERS[1]) */
export const CHAPTERS = ['1장 · 망자의 무덤', '2장 · 불타는 고블린 굴'];
export const chapterOf = (st: Stage) => Number(st.id.split('-')[0]) - 1;
/** 스테이지 순서별 별 조건 2·3 (시간 제한은 웨이브 수로 정한다) */
type CondMaker = (w: number, boss: boolean) => Cond;
const T = (per: number): CondMaker => (w, boss) => ({ k: 'time', n: per * w + (boss ? 30 : 0) });
const C = (c: Cond): CondMaker => () => c;
const COND_PLAN: [CondMaker, CondMaker][] = [
  [C({ k: 'nodeath' }), T(25)],
  [C({ k: 'hp', n: 50 }), T(22)],
  [C({ k: 'nodeath' }), C({ k: 'ult', n: 1 })],
  [C({ k: 'size', n: 3 }), T(25)],
  [C({ k: 'nodeath' }), C({ k: 'hp', n: 60 })],
  [C({ k: 'ult', n: 0 }), T(25)],
  [C({ k: 'nodeath' }), C({ k: 'size', n: 3 })],
  [C({ k: 'hp', n: 50 }), C({ k: 'ult', n: 2 })],
  [C({ k: 'nodeath' }), T(22)],
  [C({ k: 'nodeath' }), T(25)],
];
const chapter = (ch: number, list: [name: string, level: number, waves: Wave[], gold: number][]): Stage[] =>
  list.map(([name, level, waves, gold], i) => {
    const boss = waves.some(w => w.boss);
    const [c2, c3] = COND_PLAN[(i + ch * 3) % COND_PLAN.length];
    return { id: `${ch + 1}-${i + 1}`, name, level, waves, reward: { gold, gems: boss ? 300 : 150 }, conds: [{ k: 'clear' }, c2(waves.length, boss), c3(waves.length, boss)] };
  });
export const STAGES: Stage[] = [
  ...chapter(0, [
    ['무너진 입구', 1, [W1_SMALL], 300],
    ['이끼 낀 계단', 2, [W1_DEAD], 350],
    ['뼈의 회랑', 3, [W1_SMALL, W1_DEAD], 450],
    ['무덤지기의 오두막', 4, [W1_DEAD, W1_GRAVE], 500],
    ['썩은 우물', 5, [W1_HORDE, W1_DEAD], 600],
    ['촛불 예배당', 6, [W1_CULT, W1_RITUAL], 650],
    ['화살 회랑', 7, [W1_GRAVE, W1_ARCH], 750],
    ['피의 제단', 8, [W1_HORDE, W1_RITUAL, W1_CULT], 850],
    ['봉인된 문', 9, [W1_ARCH, W1_CULT, W1_GRAVE], 950],
    ['군주의 방', 10, [W1_DEAD, W1_CULT, W1_BOSS], 1200],
  ]),
  ...chapter(1, [
    ['연기 굴 입구', 10, [W2_SMALL, W2_GOB], 1200],
    ['그을린 갱도', 11, [W2_GOB, W2_PACK], 1300],
    ['약탈자 소굴', 11, [W2_GOB, W2_RAID], 1450],
    ['임프 둥지', 12, [W2_IMPS, W2_ORC], 1600],
    ['전쟁 막사', 13, [W2_WAR, W2_RAID], 1750],
    ['용암 다리', 13, [W2_PACK, W2_IMPS, W2_ORC], 1900],
    ['주술사의 동굴', 14, [W2_IMPS, W2_GOB, W2_WAR], 2050],
    ['투기장', 15, [W2_WAR, W2_RAID, W2_ORC], 2200],
    ['지옥문', 16, [W2_RAID, W2_IMPS, W2_WAR], 2400],
    ['악마의 제단', 17, [W2_ORC, W2_RAID, W2_BOSS], 2800],
  ]),
];
/** 요일 던전·무한탑이 섞어 쓰는 웨이브 (modes.ts) */
export const WAVE_POOL = {
  undead: [W1_SMALL, W1_DEAD, W1_GRAVE, W1_HORDE, W1_CULT, W1_RITUAL, W1_ARCH],
  goblin: [W2_SMALL, W2_GOB, W2_PACK, W2_IMPS, W2_ORC, W2_WAR, W2_RAID],
  boss: [W1_BOSS, W2_BOSS],
};
/** 스테이지 별 개수 (저장의 비트 수) */
export const starCount = (bits = 0) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
/** 스테이지에 나오는 적 (보스가 부르는 적은 그 웨이브에 같이 넣어 둔다) */
export const stageEnemies = (st: Stage) => [...new Set(st.waves.flatMap(w => w.units.map(([k]) => k)))].map(k => ENEMIES[k]);

// 레벨에 따른 능력치 배율 (HP·공격·방어에 곱한다)
export const heroMul = (lv: number) => 1 + 0.08 * (lv - 1);
export const enemyMul = (lv: number) => 1 + 0.1 * (lv - 1);

export const repeatGems = (st: Stage) => Math.round(st.reward.gems / 10);
export const starGems = (st: Stage) => Math.round(st.reward.gems / 3);

// 레벨업: 골드만 쓴다. 최대 레벨은 지금 등급이 정한다 (design.md 3.3)
const MAX_LEVELS = [40, 50, 60, 70, 80, 90, 100, 120];
export const maxLevel = (grade: number, stars = 0) => MAX_LEVELS[grade] + 5 * stars;   // 별마다 +5
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
