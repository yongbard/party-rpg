// 적: 일반 적은 영웅과 같은 조합형 재료(Quaternius 몸·옷·무기·UAL 동작)로, 보스는 Ultimate Monsters(um/)로 만든다
// 1장 망자의 무덤(좀비·사교도), 2장 불타는 고블린 굴(고블린·임프·오크)
import { Vector3 } from '@babylonjs/core';
import { COL, lowestHpRatio, QS } from './common';
import type { Anims, UnitDef } from './data';
import { BLADE_ANIMS, F, FEMALE_PEASANT, G, H, HEAVY_ANIMS, M, SPELL_ANIMS, W } from './heroes';
import type { Battle } from './battle';
import type { Unit } from './unit';

const ZOMBIE_ANIMS: Anims = {
  idle: 'Zombie_Idle_Loop', run: 'Zombie_Walk_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01',
  attack: ['Zombie_Scratch'], spawn: 'LayToIdle',
};
const BOW_ANIMS: Anims = {
  idle: 'Pistol_Idle_Loop', run: 'Jog_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01', attack: ['Pistol_Shoot'],
};
const THROW_ANIMS: Anims = {
  idle: 'Sword_Idle', run: 'Jog_Fwd_Loop', hit: 'Hit_Chest', death: 'Death01', attack: ['OverhandThrow'],
};
/** Ultimate Monsters 공용 동작 (파일 안 이름에서 'CharacterArmature|' 를 뗀 것) */
const UM_WALKER: Anims = { idle: 'Idle', run: 'Run', hit: 'HitReact', death: 'Death', attack: ['Punch', 'Weapon'], extra: ['Jump', 'Wave', 'Yes'] };
const UM_FLYER: Anims = { idle: 'Flying_Idle', run: 'Fast_Flying', hit: 'HitReact', death: 'Death', attack: ['Punch', 'Headbutt'], extra: ['Yes', 'No'] };

const ZOMBIE_SKIN: [number, number, number] = [0.5, 0.78, 0.45];

/** 쓰러진 적이 너무 많지 않으면 보스 곁에 일으킨다 */
function raise(b: Battle, u: Unit, kind: string, n: number) {
  const alive = b.alliesOf(u).length;
  for (let i = 0; i < Math.min(n, 7 - alive); i++) {
    const p = u.pos.add(new Vector3((i % 2 ? 1 : -1) * (1.8 + i * 0.4), 0, -0.6));
    const z = b.spawnEnemy(kind, p.x, p.z);
    b.fx.burst(z.pos.add(new Vector3(0, 0.2, 0)), COL.purple, 18, 3, 0.25);
  }
}

export const ENEMIES: Record<string, UnitDef> = {
  // ───────── 1장 · 망자의 무덤 ─────────
  zombie: {
    id: 'zombie', name: '굶주린 망자', model: 'q', scale: QS, color: '#9b9',
    looks: [{ body: 'q/head/Human_Male', parts: [M('Peasant_Body'), M('Peasant_Legs')], tint: [0.45, 0.42, 0.38], skin: ZOMBIE_SKIN }],
    stats: { hp: 820, atk: 78, def: 12, spd: 85, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 1, range: 1.5, move: 1.9 },
    anims: ZOMBIE_ANIMS, hitAt: 0.45, targeting: 'threat', skills: [],
  },
  zombie_f: {
    id: 'zombie_f', name: '울부짖는 망자', model: 'q', scale: QS, color: '#9b9',
    looks: [{ body: 'q/head/Human_Female', hair: [H('Hair_Long')], parts: [F('Peasant_Body'), F('Peasant_Legs')], tint: [0.4, 0.42, 0.5], skin: [0.68, 0.74, 0.82] }],
    stats: { hp: 700, atk: 86, def: 10, spd: 95, crit: 0.08, critDmg: 1.5, healPow: 1, threat: 1, range: 1.5, move: 2.3 },
    anims: ZOMBIE_ANIMS, hitAt: 0.45, targeting: 'threat', skills: [],
  },
  gravedigger: {
    id: 'gravedigger', name: '무덤지기', model: 'q', scale: QS, color: '#b97',
    looks: [{ body: 'q/head/Human_Male', hair: [H('Hair_Beard'), H('Eyebrows_Regular')], parts: [M('Peasant_Body'), M('Ranger_Arms'), M('Peasant_Legs'), M('Ranger_Feet_Boots')], weapon: W('Shovel_04'), tint: [0.42, 0.36, 0.3], skin: [0.85, 0.8, 0.75] }],
    stats: { hp: 1400, atk: 100, def: 40, spd: 85, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 1, range: 1.8, move: 2.2 },
    anims: HEAVY_ANIMS, hitAt: 0.45, targeting: 'threat',
    skills: [{
      name: '삽 내려치기', cd: 10, anim: 'Sword_Heavy_Combo', hitAt: 0.6, melee: true,
      run: (b, u) => { const t = u.target; if (!t) return; b.damage(u, t, 1.5); b.stun(t, 0.8); b.fx.ring(t.pos, COL.bone, 1.6, 0.4); },
    }],
  },
  cultist: {
    id: 'cultist', name: '사교도 칼잡이', model: 'q', scale: QS, color: '#a7c',
    looks: [{ body: 'q/head/Human_Male', hair: [H('Eyebrows_Regular')], parts: ['Body', 'Arms', 'Legs', 'Feet_Boots', 'Head_Hood'].map(n => M(`Ranger_${n}`)), weapon: W('Dagger_02'), tint: [0.3, 0.18, 0.36] }],
    stats: { hp: 750, atk: 95, def: 15, spd: 105, crit: 0.12, critDmg: 1.6, healPow: 1, threat: 1, range: 1.5, move: 2.8 },
    anims: BLADE_ANIMS, hitAt: 0.3, targeting: 'threat', skills: [],
  },
  acolyte: {
    id: 'acolyte', name: '사교 술사', model: 'q', scale: QS, color: '#c66',
    looks: [{ body: 'q/head/Human_Female', hair: [H('Eyebrows_Female')], parts: ['Body', 'Arms', 'Legs', 'Feet', 'Head_Hood'].map(n => F(`Ranger_${n}`)), weapon: W('kk_staff_A'), tint: [0.45, 0.12, 0.16], glow: [0.7, 0.2, 1] }],
    stats: { hp: 800, atk: 110, def: 14, spd: 85, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 1, range: 8, move: 2.2 },
    anims: SPELL_ANIMS, hitAt: 0.35, projectile: 'dark', targeting: 'threat',
    skills: [{
      name: '어둠의 축복', cd: 11, anim: 'Spell_Simple_Enter', hitAt: 0.3,
      can: (b, u) => b.alliesOf(u).some(a => a.hp / a.maxHp < 0.7),
      run: (b, u) => { const t = lowestHpRatio(b.alliesOf(u)); if (t) { b.heal(u, t, 2.2); b.fx.ring(t.pos, COL.purple, 1.4, 0.5); } },
    }],
  },
  hunter: {
    id: 'hunter', name: '사교 사냥꾼', model: 'q', scale: QS, color: '#7a6',
    looks: [{ body: 'q/head/Human_Male', hair: [H('Hair_Long'), H('Eyebrows_Regular')], parts: ['Body', 'Arms', 'Legs', 'Feet_Boots', 'Acc_Pauldron'].map(n => M(`Ranger_${n}`)), weapon: W('kk_bow_A_withString'), tint: [0.28, 0.3, 0.22] }],
    stats: { hp: 700, atk: 90, def: 12, spd: 95, crit: 0.1, critDmg: 1.5, healPow: 1, threat: 1, range: 9, move: 2.4 },
    anims: BOW_ANIMS, hitAt: 0.25, projectile: 'bolt', targeting: 'threat', skills: [],
  },
  lich: {
    id: 'lich', name: '망령 군주 바르크', model: 'um/Ghost_Skull', fit: 0.64, scale: 1.8, boss: true, color: '#c4f',
    eyeGlow: [0.8, 0.3, 1],
    stats: { hp: 13000, atk: 150, def: 50, spd: 80, crit: 0.08, critDmg: 1.6, healPow: 1, threat: 1, range: 2.6, move: 2.0 },
    anims: UM_FLYER, hitAt: 0.4, targeting: 'threat',
    skills: [
      {
        name: '영혼 휩쓸기', cd: 9, anim: 'Punch', hitAt: 0.4, melee: true,
        run: (b, u) => {
          b.fx.ring(u.pos, COL.purple, 4, 0.4);
          for (const h of b.near(u.pos, b.foesOf(u), 4)) b.damage(u, h, 1.1);
        },
      },
      {
        name: '망자 일으키기', cd: 16, anim: 'Yes', hitAt: 0.5,
        run: (b, u) => { b.hud.banner('망자 일으키기', '바르크가 망자를 깨웁니다', true); raise(b, u, 'zombie', 2); },
      },
    ],
    ult: {
      name: '망령의 비명', desc: '', cutAnim: 'No',
      run: (b, u) => {
        const t = u.target ?? b.foesOf(u)[0]; if (!t) return;
        const at = t.pos.clone();
        u.faceNow(at);
        u.play('No', false);
        u.busyUntil = b.time + 2.4;
        b.hud.banner('망령의 비명', '바르크가 비명을 내지릅니다', true);
        b.fx.telegraph(at, 4.2, 1.7);
        b.after(1.2, () => { if (u.alive) u.play('Headbutt', false); });
        b.after(1.7, () => {
          if (!u.alive) return;
          b.fx.ring(at, COL.purple, 5.5, 0.5);
          b.fx.burst(at.add(new Vector3(0, 0.3, 0)), COL.purple, 40, 7, 0.3);
          b.shake(0.6);
          for (const h of b.near(at, b.foesOf(u), 4.2)) { b.damage(u, h, 1.8, { noGauge: true }); b.stun(h, 0.6); }
        });
      },
    },
  },

  // ───────── 2장 · 불타는 고블린 굴 ─────────
  goblin: {
    id: 'goblin', name: '고블린 약탈자', model: 'q', scale: QS, color: '#9c6',
    looks: [{ body: 'q/body/Puglin', weapon: W('Axe_02'), skin: [0.8, 0.95, 0.72] }],
    stats: { hp: 650, atk: 85, def: 12, spd: 110, crit: 0.1, critDmg: 1.5, healPow: 1, threat: 1, range: 1.5, move: 3.0 },
    anims: BLADE_ANIMS, hitAt: 0.3, targeting: 'threat', skills: [],
  },
  goblin_shaman: {
    id: 'goblin_shaman', name: '고블린 주술사', model: 'q', scale: QS, color: '#6c9',
    looks: [{ body: 'q/body/Puglin', cloak: G('Mage_Cape'), weapon: W('kk_wand_A'), skin: [0.7, 0.9, 0.85], glow: [0.4, 1, 0.5] }],
    stats: { hp: 700, atk: 95, def: 12, spd: 90, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 1, range: 8, move: 2.4 },
    anims: SPELL_ANIMS, hitAt: 0.35, projectile: 'magic', targeting: 'threat',
    skills: [{
      name: '주술 치유', cd: 10, anim: 'Spell_Simple_Enter', hitAt: 0.3,
      can: (b, u) => b.alliesOf(u).some(a => a.hp / a.maxHp < 0.7),
      run: (b, u) => { for (const a of b.alliesOf(u)) b.heal(u, a, 0.9); b.fx.ring(u.pos, COL.green, 4, 0.5); },
    }],
  },
  imp: {
    id: 'imp', name: '불꽃 임프', model: 'q', scale: QS, color: '#f84',
    looks: [{ body: 'q/body/Imp', weapon: W('Dagger_06'), skin: [1.25, 0.6, 0.45], glow: [1, 0.5, 0.15] }],
    stats: { hp: 720, atk: 100, def: 14, spd: 115, crit: 0.12, critDmg: 1.6, healPow: 1, threat: 1, range: 1.5, move: 3.2 },
    anims: BLADE_ANIMS, hitAt: 0.3, targeting: 'threat',
    skills: [{
      name: '불씨 찌르기', cd: 8, anim: 'Sword_Dash', hitAt: 0.3, melee: true,
      run: (b, u) => { const t = u.target; if (!t) return; b.damage(u, t, 1.0); b.dot(u, t, 0.3, 4); b.fx.burst(t.chest(), COL.red, 16, 4, 0.2); },
    }],
  },
  orc: {
    id: 'orc', name: '오크 도살자', model: 'q', scale: QS, color: '#8a6',
    looks: [{ body: 'q/body/Orc_Male', helmet: G('Knight_Helmet'), parts: [M('Ranger_Acc_Pauldron')], weapon: W('Hammer_04'), skin: [0.75, 0.7, 0.6] }],
    stats: { hp: 1700, atk: 115, def: 45, spd: 80, crit: 0.05, critDmg: 1.5, healPow: 1, threat: 1, range: 1.8, move: 2.2 },
    anims: HEAVY_ANIMS, hitAt: 0.45, targeting: 'threat',
    skills: [{
      name: '전쟁 함성', cd: 15, anim: 'Sword_Heavy_Combo', hitAt: 0.3,
      run: (b, u) => { for (const a of b.alliesOf(u)) b.buff(a, 0.2, 10, 6); b.fx.ring(u.pos, COL.red, 5, 0.6); },
    }],
  },
  orc_spear: {
    id: 'orc_spear', name: '오크 투창병', model: 'q', scale: QS, color: '#a86',
    looks: [{ body: 'q/body/Orc_Female', parts: [...FEMALE_PEASANT.filter(p => !/Feet/.test(p)), F('Ranger_Acc_Pauldrons')], weapon: W('Spear_02'), tint: [0.45, 0.35, 0.3] }],
    stats: { hp: 850, atk: 105, def: 18, spd: 90, crit: 0.08, critDmg: 1.5, healPow: 1, threat: 1, range: 8.5, move: 2.4 },
    anims: THROW_ANIMS, hitAt: 0.35, projectile: 'bone', targeting: 'threat', skills: [],
  },
  demon: {
    id: 'demon', name: '불꽃 악마 아즈라', model: 'um/Demon', fit: 0.68, scale: 1.9, boss: true, color: '#f53',
    eyeGlow: [1, 0.45, 0.1],
    stats: { hp: 20000, atk: 175, def: 60, spd: 80, crit: 0.08, critDmg: 1.6, healPow: 1, threat: 1, range: 2.6, move: 2.0 },
    anims: UM_WALKER, hitAt: 0.4, targeting: 'threat',
    skills: [
      {
        name: '화염 휩쓸기', cd: 9, anim: 'Weapon', hitAt: 0.45, melee: true,
        run: (b, u) => {
          b.fx.ring(u.pos, COL.red, 4.2, 0.4);
          for (const h of b.near(u.pos, b.foesOf(u), 4.2)) { b.damage(u, h, 1.0); b.dot(u, h, 0.25, 3); }
        },
      },
      {
        name: '임프 부르기', cd: 18, anim: 'Wave', hitAt: 0.5,
        run: (b, u) => { b.hud.banner('임프 부르기', '아즈라가 임프를 부릅니다', true); raise(b, u, 'imp', 2); },
      },
    ],
    ult: {
      name: '지옥불 낙하', desc: '', cutAnim: 'Yes',
      run: (b, u) => {
        const t = u.target ?? b.foesOf(u)[0]; if (!t) return;
        const at = t.pos.clone();
        u.faceNow(at);
        u.play('Yes', false);
        u.busyUntil = b.time + 2.4;
        b.hud.banner('지옥불 낙하', '아즈라가 뛰어오릅니다', true);
        b.fx.telegraph(at, 4.6, 1.7);
        b.after(1.0, () => { if (u.alive) u.play('Jump', false); });
        b.after(1.7, () => {
          if (!u.alive) return;
          b.fx.ring(at, COL.red, 6, 0.5);
          b.fx.burst(at.add(new Vector3(0, 0.3, 0)), COL.red, 46, 8, 0.3);
          b.shake(0.7);
          for (const h of b.near(at, b.foesOf(u), 4.6)) { b.damage(u, h, 1.9, { noGauge: true }); b.dot(u, h, 0.3, 3); }
        });
      },
    },
  },
};
