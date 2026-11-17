// 3-5 에서 늘린 영웅 12명. 잠재 등급을 아래쪽에 많이, 위쪽에 적게 둔다 (희귀 3 · 영웅 4 · 전설 3 · 신화 1 · 불멸 1)
// 외형은 등급마다 앞 등급에 무엇을 더하거나 바꾸는지로 적는다 (grow). 같은 영웅은 얼굴·체형이 끝까지 같다
import { COL, lowestHpRatio, QS } from './common';
import type { Anims, Look, UnitDef } from './data';

type Step = Partial<Look> & { add?: string[]; drop?: RegExp };
/** 등급별 외형: 첫 외형에서 한 단계씩 바꿔 간다 (add 는 파츠 추가, drop 은 그 이름의 파츠를 뺀다) */
function grow(base: Look, ...steps: Step[]): Look[] {
  const out = [base];
  for (const { add, drop, ...rest } of steps) {
    const prev = out[out.length - 1];
    let parts = (rest.parts ?? prev.parts ?? []).filter(p => !drop?.test(p));
    if (add) parts = [...parts, ...add];
    out.push({ ...prev, ...rest, parts });
  }
  return out;
}
const M = (n: string) => `q/part/Male_${n}`;
const F = (n: string) => `q/part/Female_${n}`;
const H = (n: string) => `q/hair/${n}`;
const W = (n: string) => `q/weapon/${n}`;
const G = (n: string) => `q/gear/${n}`;
const MALE_PEASANT = ['Peasant_Body', 'Peasant_Arms', 'Peasant_Legs', 'Peasant_Feet'].map(M);
const FEMALE_PEASANT = ['Peasant_Body', 'Peasant_Arms', 'Peasant_Legs', 'Peasant_Feet'].map(F);

const SHIELD_ANIMS: Anims = {
  idle: 'Idle_Shield_Loop', run: 'Jog_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01', victory: 'Yes',
  attack: ['Sword_Regular_A', 'Sword_Regular_B'], extra: ['Shield_OneShot', 'Shield_Dash', 'Sword_Block'],
};
const BLADE_ANIMS: Anims = {
  idle: 'Sword_Idle', run: 'Jog_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01', victory: 'Yes',
  attack: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'], extra: ['Sword_Regular_Combo', 'Sword_Dash'],
};
const HEAVY_ANIMS: Anims = {
  idle: 'Sword_Idle', run: 'Jog_Fwd_Loop', hit: 'Hit_Knockback', death: 'Death01', victory: 'Yes',
  attack: ['Sword_Attack', 'Sword_Regular_C'], extra: ['Sword_Heavy_Combo'],
};
const SPELL_ANIMS: Anims = {
  idle: 'Spell_Simple_Idle_Loop', run: 'Jog_Fwd_Loop', hit: 'Hit_Head', death: 'Death01', victory: 'Yes',
  attack: ['Spell_Simple_Shoot'], extra: ['Spell_Simple_Enter'],
};

export const MORE_HEROES: UnitDef[] = [
  // ───────── 잠재 희귀 ─────────
  {
    id: 'dorin', name: '도린', title: '성문 경비', archetype: '탱커', color: '#c9a46a',
    model: 'q', scale: QS, maxGrade: 2,
    titles: ['성문 경비', '경비대원', '경비대장'],
    looks: grow(
      { body: 'q/head/Human_Male', hair: [H('Hair_Buzzed'), H('Eyebrows_Regular')], parts: MALE_PEASANT, weapon: W('Mace_01'), offhand: W('kk_shield_A'), tint: [0.85, 0.8, 0.7] },
      { drop: /Peasant_Feet/, add: [M('Ranger_Feet_Boots')], weapon: W('Mace_03') },
      { helmet: G('Knight_Helmet'), cloak: G('Knight_Cape'), weapon: W('Mace_05'), offhand: W('kk_shield_B'), tint: [0.7, 0.75, 0.9] },
    ),
    stats: { hp: 1400, atk: 70, def: 55, spd: 90, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 2.2, range: 1.6, move: 3.4 },
    anims: SHIELD_ANIMS, hitAt: 0.38, targeting: 'nearest',
    skills: [{
      name: '방패 밀치기', desc: '공격력 120% 피해, 0.8초 기절, 위협 증가', cd: 8, anim: 'Shield_OneShot', hitAt: 0.35, melee: true,
      run: (b, u) => {
        const t = u.target; if (!t) return;
        b.damage(u, t, 1.2);
        b.stun(t, 0.8);
        u.threat += 300;
        b.fx.ring(t.pos, COL.gold, 1.6, 0.35);
      },
    }],
    ult: {
      name: '성문 사수', desc: '주변 적 5초 도발 · 받는 피해 40% 감소 · 최대 HP 12% 보호막', cutAnim: 'Sword_Block',
      run: (b, u) => {
        u.play('Sword_Block', false);
        u.busyUntil = b.time + 1;
        b.fx.ring(u.pos, COL.gold, 5, 0.6);
        for (const e of b.near(u.pos, b.foesOf(u), 5)) b.taunt(e, u, 5);
        b.addDr(u, 0.4, 5);
        b.addShield(u, u.maxHp * 0.12);
        b.fx.bubble(u, COL.gold, 5);
      },
    },
  },
  {
    id: 'mia', name: '미아', title: '약초꾼', archetype: '치유', color: '#8fd88a',
    model: 'q', scale: QS, maxGrade: 2,
    titles: ['약초꾼', '견습 치유사', '마을 치유사'],
    looks: grow(
      { body: 'q/head/Human_Female', hair: [H('Hair_BuzzedFemale'), H('Eyebrows_Female')], parts: FEMALE_PEASANT, cloak: G('Rogue_Cape'), weapon: W('kk_wand_A'), tint: [0.8, 1, 0.75] },
      { drop: /Peasant_Feet/, add: [F('Ranger_Feet')], weapon: W('kk_staff_A') },
      { drop: /Peasant_Arms/, add: [F('Ranger_Arms')], cloak: G('Mage_Cape'), tint: [0.7, 0.95, 0.75], glow: [0.5, 1, 0.6] },
    ),
    stats: { hp: 850, atk: 95, def: 22, spd: 100, crit: 0.05, critDmg: 1.5, healPow: 1.3, threat: 0.7, range: 8, move: 3.2 },
    anims: SPELL_ANIMS, hitAt: 0.35, projectile: 'magic', targeting: 'nearest',
    skills: [{
      name: '약초 치료', desc: 'HP 비율이 가장 낮은 아군을 공격력 150% 만큼 치유', cd: 5, anim: 'Spell_Simple_Enter', hitAt: 0.45,
      can: (b, u) => b.alliesOf(u).some(a => a.hp / a.maxHp < 0.75),
      run: (b, u) => { const t = lowestHpRatio(b.alliesOf(u)); if (t) b.heal(u, t, 1.5); },
    }],
    ult: {
      name: '치유의 비', desc: '아군 전체를 세 번 치유 (공격력 90%씩)', cutAnim: 'Spell_Simple_Idle_Loop',
      run: (b, u) => {
        u.play('Spell_Simple_Shoot', false);
        u.busyUntil = b.time + 1.6;
        for (let i = 0; i < 3; i++) b.after(i * 0.8, () => { for (const a of b.alliesOf(u)) b.heal(u, a, 0.9); });
      },
    },
  },
  {
    id: 'pug', name: '푸그', title: '꼬마 좀도둑', archetype: '암살', color: '#d8a35a',
    model: 'q', scale: QS, maxGrade: 2,
    titles: ['꼬마 좀도둑', '소매치기', '골목 대장'],
    looks: grow(
      { body: 'q/body/Puglin', weapon: W('Dagger_01') },
      { weapon: W('Dagger_04'), helmet: G('Skeleton_Rogue_Hood') },
      { weapon: W('kk_dagger_A'), cloak: G('Rogue_Cape'), glow: [1, 0.8, 0.4] },
    ),
    stats: { hp: 800, atk: 120, def: 20, spd: 125, crit: 0.25, critDmg: 1.8, healPow: 1, threat: 0.8, range: 1.5, move: 4.2 },
    anims: BLADE_ANIMS, hitAt: 0.3, targeting: 'nearest',
    skills: [{
      name: '기습', desc: 'HP 비율이 가장 낮은 적에게 달려들어 공격력 180% 피해', cd: 7, anim: 'Sword_Dash', hitAt: 0.3,
      run: (b, u) => {
        const t = lowestHpRatio(b.foesOf(u)); if (!t) return;
        u.faceNow(t.pos);
        u.pos.copyFrom(t.pos.add(u.pos.subtract(t.pos).normalize().scale(1.2)));   // 대상 옆으로 붙는다
        b.damage(u, t, 1.8);
        b.fx.slash(t.chest(), COL.gold);
      },
    }],
    ult: {
      name: '주머니 털기', desc: '대상에게 확정 치명 4연타 (공격력 90%씩)', cutAnim: 'Sword_Regular_Combo',
      run: (b, u) => {
        const t = u.target ?? b.foesOf(u)[0]; if (!t) return;
        u.play('Sword_Regular_Combo', false, 1.4);
        u.busyUntil = b.time + 1.4;
        for (let i = 0; i < 4; i++) b.after(0.15 + i * 0.3, () => { if (t.alive) { b.damage(u, t, 0.9, { crit: true, noGauge: true }); b.fx.slash(t.chest(), COL.gold); } });
      },
    },
  },
  // ───────── 잠재 영웅 ─────────
  {
    id: 'hagen', name: '하겐', title: '대장장이', archetype: '광역 딜탱', color: '#d9783c',
    model: 'q', scale: QS, maxGrade: 3,
    titles: ['대장간 견습', '대장장이', '무기 장인', '전장의 대장장이'],
    looks: grow(
      { body: 'q/head/Human_Male', hair: [H('Hair_Beard'), H('Eyebrows_Regular')], parts: [M('Peasant_Body'), M('Ranger_Arms'), M('Peasant_Legs'), M('Peasant_Feet')], weapon: W('Hammer_01'), tint: [0.75, 0.6, 0.5] },
      { add: [M('Ranger_Acc_Pauldron')], weapon: W('Hammer_03') },
      { drop: /Peasant_Feet/, add: [M('Ranger_Feet_Boots')], cloak: G('Barbarian_Cape'), weapon: W('Hammer_05'), tint: [0.6, 0.45, 0.38] },
      { weapon: W('kk_hammer_A'), glow: [1, 0.5, 0.15], scale: 1.04 },
    ),
    stats: { hp: 1300, atk: 120, def: 45, spd: 85, crit: 0.1, critDmg: 1.7, healPow: 1, threat: 1.5, range: 1.8, move: 3.4 },
    anims: HEAVY_ANIMS, hitAt: 0.45, targeting: 'nearest',
    skills: [{
      name: '모루 내려치기', desc: '대상 주변 적에게 공격력 150% 피해와 1초 기절', cd: 9, anim: 'Sword_Heavy_Combo', hitAt: 0.6, melee: true,
      run: (b, u) => {
        const t = u.target; if (!t) return;
        for (const e of b.near(t.pos, b.foesOf(u), 2.6)) { b.damage(u, e, 1.5); b.stun(e, 1); }
        b.fx.ring(t.pos, COL.gold, 2.6, 0.4);
        b.fx.fire(t.pos, 0.6);
        b.shake(0.15);
      },
    }],
    ult: {
      name: '불꽃 담금질', desc: '아군 전체 공격력 25% 증가 8초 · 주변 적에게 공격력 250% 피해', cutAnim: 'Sword_Heavy_Combo',
      run: (b, u) => {
        u.play('Sword_Heavy_Combo', false);
        u.busyUntil = b.time + 1.2;
        for (const a of b.alliesOf(u)) { b.buff(a, 0.25, 0, 8); b.fx.burst(a.chest(), COL.gold, 16, 3); }
        b.after(0.6, () => {
          for (const e of b.near(u.pos, b.foesOf(u), 3.5)) b.damage(u, e, 2.5, { noGauge: true });
          b.fx.ring(u.pos, COL.red, 3.5, 0.5);
          b.shake(0.3);
        });
      },
    },
  },
  {
    id: 'lia', name: '리아', title: '숲 정찰병', archetype: '연타 딜러', color: '#5fd0b0',
    model: 'q', scale: QS, maxGrade: 3,
    titles: ['숲의 아이', '숲 정찰병', '칼날 무희', '바람 칼날'],
    looks: grow(
      { body: 'q/body/Elf_Female', parts: [F('Ranger_Body'), F('Peasant_Legs')], weapon: W('Sabre_01') },
      { add: [F('Ranger_Feet')], weapon: W('Sabre_03') },
      { cloak: G('Rogue_Cape'), weapon: W('kk_sword_B'), tint: [0.7, 0.95, 0.85] },
      { add: [F('Ranger_Acc_Pauldrons')], weapon: W('kk_sword_C'), glow: [0.4, 1, 0.85], scale: 1.04 },
    ),
    stats: { hp: 950, atk: 125, def: 28, spd: 130, crit: 0.2, critDmg: 1.7, healPow: 1, threat: 0.9, range: 1.5, move: 4.2 },
    anims: BLADE_ANIMS, hitAt: 0.3, targeting: 'nearest',
    skills: [{
      name: '질풍 베기', desc: '대상에게 공격력 70% 3연타 · 4초간 공격 속도 +30', cd: 7, anim: 'Sword_Regular_Combo', hitAt: 0.2, melee: true,
      run: (b, u) => {
        const t = u.target; if (!t) return;
        for (let i = 0; i < 3; i++) b.after(i * 0.15, () => { if (t.alive) { b.damage(u, t, 0.7); b.fx.slash(t.chest(), COL.green); } });
        b.buff(u, 0, 30, 4);
      },
    }],
    ult: {
      name: '칼날 폭풍', desc: '대상 주변 적에게 8번 베기 (공격력 60%씩)', cutAnim: 'Sword_Dash',
      run: (b, u) => {
        const t = u.target ?? b.foesOf(u)[0]; if (!t) return;
        u.play('Sword_Regular_Combo', true, 1.5);
        u.busyUntil = b.time + 1.8;
        for (let i = 0; i < 8; i++) b.after(0.1 + i * 0.2, () => {
          const list = b.near(t.pos, b.foesOf(u), 3);
          const e = list[Math.floor(Math.random() * list.length)];
          if (e) { b.damage(u, e, 0.6, { noGauge: true }); b.fx.slash(e.chest(), COL.green); }
        });
      },
    },
  },
  {
    id: 'gorga', name: '고르가', title: '부족 무당', archetype: '강화 지원', color: '#c4553e',
    model: 'q', scale: QS, maxGrade: 3,
    titles: ['부족 견습 무당', '부족 무당', '대무당', '혈족의 목소리'],
    looks: grow(
      { body: 'q/body/Orc_Female', parts: [F('Peasant_Body'), F('Peasant_Legs')], weapon: W('kk_wand_A'), tint: [0.85, 0.7, 0.6] },
      { weapon: W('kk_staff_A'), cloak: G('Barbarian_Cape') },
      { add: [F('Ranger_Arms'), F('Ranger_Acc_Pauldrons')], tint: [0.8, 0.5, 0.45] },
      { weapon: W('kk_staff_B'), glow: [1, 0.3, 0.2], aura: [1, 0.3, 0.2], scale: 1.04 },
    ),
    stats: { hp: 1000, atk: 100, def: 30, spd: 100, crit: 0.08, critDmg: 1.5, healPow: 1.15, threat: 0.9, range: 8, move: 3.3 },
    anims: SPELL_ANIMS, hitAt: 0.35, projectile: 'magic', targeting: 'nearest',
    skills: [
      {
        name: '전쟁의 북', desc: '아군 전체 공격력 20% 증가 6초', cd: 10, anim: 'Spell_Simple_Enter', hitAt: 0.4,
        run: (b, u) => { for (const a of b.alliesOf(u)) { b.buff(a, 0.2, 0, 6); b.fx.ring(a.pos, COL.red, 1.2, 0.4); } },
      },
      {
        name: '상처 동여매기', desc: 'HP 비율이 가장 낮은 아군을 공격력 120% 만큼 치유', cd: 6, anim: 'Spell_Simple_Enter', hitAt: 0.45,
        can: (b, u) => b.alliesOf(u).some(a => a.hp / a.maxHp < 0.7),
        run: (b, u) => { const t = lowestHpRatio(b.alliesOf(u)); if (t) b.heal(u, t, 1.2); },
      },
    ],
    ult: {
      name: '피의 의식', desc: '아군 전체 공격력 35%·공격 속도 +20, 8초 · 아군 전체 치유', cutAnim: 'Spell_Simple_Idle_Loop',
      run: (b, u) => {
        u.play('Spell_Simple_Shoot', false);
        u.busyUntil = b.time + 0.9;
        b.fx.ring(u.pos, COL.red, 8, 0.8);
        for (const a of b.alliesOf(u)) { b.buff(a, 0.35, 20, 8); b.heal(u, a, 0.6); }
      },
    },
  },
  {
    id: 'kix', name: '킥스', title: '불씨 임프', archetype: '지속 피해', color: '#ff7a3c',
    model: 'q', scale: QS, maxGrade: 3,
    titles: ['장난꾸러기 임프', '불씨 임프', '화염 임프', '지옥불 임프'],
    looks: grow(
      { body: 'q/body/Imp', weapon: W('kk_wand_A') },
      { glow: [1, 0.45, 0.1] },
      { helmet: G('Mage_Hat'), weapon: W('kk_staff_A') },
      { cloak: G('Skeleton_Rogue_Cape'), aura: [1, 0.35, 0.1], scale: 1.05 },
    ),
    stats: { hp: 800, atk: 130, def: 20, spd: 105, crit: 0.12, critDmg: 1.6, healPow: 1, threat: 0.8, range: 8.5, move: 3.6 },
    anims: SPELL_ANIMS, hitAt: 0.35, projectile: 'gold', targeting: 'nearest',
    skills: [{
      name: '불씨 뿌리기', desc: '대상과 주변 적 최대 3명에게 공격력 60% 피해 + 4초 화상 (25%씩)', cd: 7, anim: 'Spell_Simple_Shoot', hitAt: 0.35,
      run: (b, u) => {
        const t = u.target; if (!t) return;
        for (const e of b.near(t.pos, b.foesOf(u), 3).slice(0, 3)) {
          b.shoot(u, e, 'gold', () => { b.damage(u, e, 0.6); b.dot(u, e, 0.25, 4); b.fx.fire(e.pos, 0.4); });
        }
      },
    }],
    ult: {
      name: '지옥불 기둥', desc: '적 전체 공격력 140% 피해 + 5초 화상 (30%씩)', cutAnim: 'Spell_Simple_Idle_Loop',
      run: (b, u) => {
        u.play('Spell_Simple_Shoot', false);
        u.busyUntil = b.time + 0.9;
        for (const e of b.foesOf(u)) {
          b.fx.pillar(e.pos, COL.red, 0.9);
          b.after(0.35, () => { b.damage(u, e, 1.4, { noGauge: true }); b.dot(u, e, 0.3, 5); });
        }
        b.shake(0.2);
      },
    },
  },
  // ───────── 잠재 전설 ─────────
  {
    id: 'jin', name: '진', title: '무승', archetype: '근접 연타', color: '#f0a040',
    model: 'q', scale: QS, maxGrade: 4,
    titles: ['수련생', '무승', '철권', '사범', '권성'],
    looks: grow(
      { body: 'q/body/Human_Male_Full', hair: [H('Hair_Long'), H('Eyebrows_Regular')], parts: [M('Peasant_Legs')], tint: [0.85, 0.7, 0.5] },
      { weapon: W('kk_fistweapon_A'), tint: [1, 0.75, 0.45] },
      { add: [M('Ranger_Arms')], tint: [0.95, 0.6, 0.35] },
      { add: [M('Peasant_Feet')], weapon: W('kk_fistweapon_B'), glow: [1, 0.7, 0.3] },
      { aura: [1, 0.75, 0.3], tint: [1, 0.85, 0.55], scale: 1.05 },
    ),
    stats: { hp: 1250, atk: 115, def: 40, spd: 125, crit: 0.18, critDmg: 1.7, healPow: 1, threat: 1.4, range: 1.4, move: 4 },
    anims: {
      idle: 'Idle_Loop', run: 'Jog_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01', victory: 'Yes',
      attack: ['Punch_Jab', 'Punch_Cross'], extra: ['Melee_Hook', 'Roll'],
    },
    hitAt: 0.22, targeting: 'nearest',
    skills: [
      {
        name: '연환권', desc: '대상에게 공격력 80% 3연타', cd: 6, anim: 'Melee_Hook', hitAt: 0.2, melee: true,
        run: (b, u) => {
          const t = u.target; if (!t) return;
          for (let i = 0; i < 3; i++) b.after(i * 0.15, () => { if (t.alive) b.damage(u, t, 0.8); });
        },
      },
      {
        name: '흘려보내기', desc: 'HP 50% 아래일 때 구르며 2초간 받는 피해 50% 감소', cd: 12, anim: 'Roll', hitAt: 0.1,
        can: (_b, u) => u.hp / u.maxHp < 0.5,
        run: (b, u) => b.addDr(u, 0.5, 2),
      },
    ],
    ult: {
      name: '백열권', desc: '대상에게 10연타 (공격력 55%씩) 후 마지막 일격 200%와 1.5초 기절', cutAnim: 'Punch_Cross',
      run: (b, u) => {
        const t = u.target ?? b.foesOf(u)[0]; if (!t) return;
        u.play('Punch_Jab', true, 2);
        u.busyUntil = b.time + 2.2;
        for (let i = 0; i < 10; i++) b.after(0.1 + i * 0.17, () => { if (t.alive) b.damage(u, t, 0.55, { noGauge: true }); });
        b.after(2, () => {
          u.play('Punch_Cross', false);
          if (t.alive) { b.damage(u, t, 2, { noGauge: true }); b.stun(t, 1.5); b.fx.ring(t.pos, COL.gold, 2.4, 0.4); b.shake(0.3); }
        });
      },
    },
  },
  {
    id: 'nora', name: '노라', title: '창병', archetype: '관통 딜러', color: '#6aa6ff',
    model: 'q', scale: QS, maxGrade: 4,
    titles: ['견습 창병', '창병', '용기병', '창술 대가', '하늘 창'],
    looks: grow(
      { body: 'q/head/Human_Female', hair: [H('Hair_Long'), H('Eyebrows_Female')], parts: ['Ranger_Body', 'Ranger_Arms', 'Ranger_Legs', 'Ranger_Feet'].map(F), weapon: W('Spear_01'), tint: [0.85, 0.85, 0.95] },
      { helmet: G('Knight_Helmet'), weapon: W('Spear_03') },
      { cloak: G('Knight_Cape'), weapon: W('kk_halberd'), tint: [0.7, 0.8, 1] },
      { add: [F('Ranger_Acc_Pauldrons')], weapon: W('Spear_07'), tint: [0.8, 0.85, 1.05] },
      { weapon: W('kk_spear_A'), glow: [0.5, 0.75, 1], aura: [0.5, 0.75, 1], scale: 1.05 },
    ),
    stats: { hp: 1150, atk: 130, def: 40, spd: 100, crit: 0.15, critDmg: 1.7, healPow: 1, threat: 1.2, range: 2.4, move: 3.8 },
    anims: BLADE_ANIMS, hitAt: 0.32, targeting: 'nearest',
    skills: [{
      name: '관통 찌르기', desc: '대상에게 공격력 170%, 대상 뒤쪽 적에게 100% 피해', cd: 7, anim: 'Sword_Dash', hitAt: 0.3, melee: true,
      run: (b, u) => {
        const t = u.target; if (!t) return;
        b.damage(u, t, 1.7);
        const dir = t.pos.subtract(u.pos).normalize();
        for (const e of b.foesOf(u)) {
          if (e === t) continue;
          const d = e.pos.subtract(u.pos);
          const along = d.x * dir.x + d.z * dir.z;
          if (along > 0 && along < 6 && Math.abs(d.x * dir.z - d.z * dir.x) < 1.2) b.damage(u, e, 1);
        }
        b.fx.slash(t.chest(), COL.blue);
      },
    }],
    ult: {
      name: '하늘 창', desc: '적 전체에 창이 떨어져 공격력 180% 피해', cutAnim: 'Sword_Dash',
      run: (b, u) => {
        u.play('Sword_Regular_C', false);
        u.busyUntil = b.time + 1;
        b.foesOf(u).forEach((e, i) => b.after(0.2 + i * 0.12, () => {
          b.fx.pillar(e.pos, COL.blue, 0.7);
          b.damage(u, e, 1.8, { noGauge: true });
        }));
        b.shake(0.25);
      },
    },
  },
  {
    id: 'ella', name: '엘라', title: '음유시인', archetype: '속도 지원', color: '#e58ad8',
    model: 'q', scale: QS, maxGrade: 4,
    titles: ['떠돌이 악사', '음유시인', '궁정 악사', '전장의 가희', '별의 노래'],
    looks: grow(
      { body: 'q/head/Human_Female', hair: [H('Hair_Buns'), H('Eyebrows_Female')], parts: [F('Peasant_Body'), F('Ranger_Arms'), F('Ranger_Legs'), F('Peasant_Feet')], helmet: G('Mage_Hat'), weapon: W('kk_wand_A'), tint: [0.85, 0.6, 0.9] },
      { drop: /Peasant_Feet/, add: [F('Ranger_Feet')] },
      { cloak: G('Mage_Cape') },
      { add: [F('Ranger_Acc_Pauldrons')], tint: [0.95, 0.55, 0.85] },
      { glow: [1, 0.6, 0.95], aura: [1, 0.6, 0.95], scale: 1.05 },
    ),
    stats: { hp: 900, atk: 105, def: 25, spd: 110, crit: 0.1, critDmg: 1.6, healPow: 1.1, threat: 0.7, range: 8, move: 3.4 },
    anims: { ...SPELL_ANIMS, extra: ['Spell_Simple_Enter', 'Dance_Loop'] }, hitAt: 0.35, projectile: 'magic', targeting: 'nearest',
    skills: [
      {
        name: '용기의 노래', desc: '아군 전체 공격 속도 +25, 공격력 10% 증가 6초', cd: 11, anim: 'Dance_Loop', hitAt: 0.3,
        run: (b, u) => { for (const a of b.alliesOf(u)) { b.buff(a, 0.1, 25, 6); b.fx.ring(a.pos, COL.purple, 1.2, 0.4); } },
      },
      {
        name: '위로의 선율', desc: '아군 전체를 공격력 50% 만큼 치유', cd: 9, anim: 'Spell_Simple_Enter', hitAt: 0.4,
        can: (b, u) => b.alliesOf(u).some(a => a.hp / a.maxHp < 0.8),
        run: (b, u) => { for (const a of b.alliesOf(u)) b.heal(u, a, 0.5); },
      },
    ],
    ult: {
      name: '별의 노래', desc: '다른 아군 필살기 게이지 +25 · 아군 전체 치유 · 공격 속도 +30, 6초', cutAnim: 'Dance_Loop',
      run: (b, u) => {
        u.play('Dance_Loop', false);
        u.busyUntil = b.time + 1.2;
        b.fx.ring(u.pos, COL.purple, 8, 0.8);
        for (const a of b.alliesOf(u)) {
          if (a !== u) a.gauge = Math.min(100, a.gauge + 25);
          b.heal(u, a, 0.8);
          b.buff(a, 0, 30, 6);
        }
      },
    },
  },
  // ───────── 잠재 신화 ─────────
  {
    id: 'morgan', name: '모르간', title: '강령술사', archetype: '흡혈 마법', color: '#9a6ad8',
    model: 'q', scale: QS, maxGrade: 5,
    titles: ['묘지기', '강령술 견습', '강령술사', '망자의 군주', '사령왕', '죽음의 현자'],
    looks: grow(
      { body: 'q/head/Human_Male', hair: [H('Hair_Long'), H('Eyebrows_Regular')], parts: [M('Ranger_Body'), M('Peasant_Arms'), M('Ranger_Legs'), M('Ranger_Feet_Boots')], weapon: W('kk_wand_A'), tint: [0.45, 0.4, 0.5] },
      { add: [M('Ranger_Head_Hood')], weapon: W('kk_staff_A') },
      { cloak: G('Skeleton_Rogue_Cape'), tint: [0.35, 0.3, 0.45] },
      { drop: /Head_Hood/, helmet: G('Skeleton_Mage_Hat'), weapon: W('kk_staff_B') },
      { add: [M('Ranger_Acc_Pauldron')], glow: [0.7, 0.35, 1], scale: 1.03 },
      { aura: [0.6, 0.3, 1], tint: [0.3, 0.25, 0.4], scale: 1.06 },
    ),
    stats: { hp: 950, atk: 135, def: 26, spd: 100, crit: 0.12, critDmg: 1.7, healPow: 1, threat: 0.8, range: 9, move: 3.3 },
    anims: SPELL_ANIMS, hitAt: 0.35, projectile: 'dark', targeting: 'nearest',
    skills: [
      {
        name: '생명 흡수', desc: '대상에게 공격력 170% 피해, 피해의 60% 회복', cd: 6, anim: 'Spell_Simple_Shoot', hitAt: 0.35,
        run: (b, u) => { const t = u.target; if (t) b.shoot(u, t, 'dark', () => b.damage(u, t, 1.7, { lifesteal: 0.6 })); },
      },
      {
        name: '저주', desc: '대상에게 5초간 공격력 30%씩 피해', cd: 9, anim: 'Spell_Simple_Enter', hitAt: 0.4,
        run: (b, u) => { const t = u.target; if (t) { b.dot(u, t, 0.3, 5); b.fx.ring(t.pos, COL.purple, 1.4, 0.5); } },
      },
    ],
    ult: {
      name: '망자의 손아귀', desc: '적 전체 공격력 130% 피해(피해의 30% 흡혈) · 아군 전체 공격력 90% 만큼 치유', cutAnim: 'Spell_Simple_Idle_Loop',
      run: (b, u) => {
        u.play('Spell_Simple_Shoot', false);
        u.busyUntil = b.time + 0.9;
        for (const e of b.foesOf(u)) {
          b.fx.pillar(e.pos, COL.purple, 0.9);
          b.after(0.35, () => b.damage(u, e, 1.3, { lifesteal: 0.3, noGauge: true }));
        }
        b.after(0.6, () => { for (const a of b.alliesOf(u)) b.heal(u, a, 0.9); });
        b.shake(0.2);
      },
    },
  },
  // ───────── 잠재 불멸 ─────────
  {
    id: 'garsh', name: '가르쉬', title: '부족장', archetype: '탱커', color: '#7fae4a',
    model: 'q', scale: QS, maxGrade: 6,
    titles: ['오크 전사', '부족 투사', '전쟁 두목', '부족장', '대족장', '대지의 분노', '불멸의 대족장'],
    looks: grow(
      { body: 'q/body/Orc_Male', helmet: G('Barbarian_Hat'), weapon: W('Mace_02'), offhand: W('kk_shield_A') },
      { cloak: G('Barbarian_Cape'), weapon: W('Mace_04') },
      { parts: [M('Ranger_Acc_Pauldron')], weapon: W('Mace_06'), offhand: W('kk_shield_B') },
      { helmet: G('Skeleton_Warrior_Helmet'), weapon: W('Mace_07'), tint: [0.8, 0.75, 0.7] },
      { offhand: W('kk_shield_C'), glow: [0.5, 1, 0.3], scale: 1.04 },
      { aura: [0.5, 1, 0.3], scale: 1.07 },
      { glow: [1, 0.35, 0.2], aura: [1, 0.35, 0.2], tint: [0.7, 0.45, 0.4], scale: 1.1 },
    ),
    stats: { hp: 1700, atk: 95, def: 65, spd: 90, crit: 0.06, critDmg: 1.5, healPow: 1, threat: 2.4, range: 1.7, move: 3.3 },
    anims: SHIELD_ANIMS, hitAt: 0.38, targeting: 'nearest', rage: 0.5,
    skills: [
      {
        name: '전쟁 함성', desc: '주변 적 4초 도발 · 4초간 받는 피해 30% 감소', cd: 10, anim: 'Shield_OneShot', hitAt: 0.3,
        run: (b, u) => {
          for (const e of b.near(u.pos, b.foesOf(u), 5)) b.taunt(e, u, 4);
          b.addDr(u, 0.3, 4);
          b.fx.ring(u.pos, COL.green, 5, 0.5);
        },
      },
      {
        name: '방패 돌진', desc: '대상에게 공격력 150% 피해와 1초 기절', cd: 8, anim: 'Shield_Dash', hitAt: 0.35, melee: true,
        run: (b, u) => { const t = u.target; if (t) { b.damage(u, t, 1.5); b.stun(t, 1); } },
      },
    ],
    ult: {
      name: '대지 진동', desc: '적 전체 공격력 120% 피해와 1.5초 기절 · 최대 HP 20% 보호막', cutAnim: 'Shield_OneShot',
      run: (b, u) => {
        u.play('Shield_OneShot', false);
        u.busyUntil = b.time + 1;
        b.after(0.35, () => {
          for (const e of b.foesOf(u)) { b.damage(u, e, 1.2, { noGauge: true }); b.stun(e, 1.5); }
          b.fx.ring(u.pos, COL.green, 10, 0.8);
          b.shake(0.4);
        });
        b.addShield(u, u.maxHp * 0.2);
        b.fx.bubble(u, COL.green, 5);
      },
    },
  },
];
