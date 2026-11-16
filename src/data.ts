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
  name: string; cd: number; anim: string; hitAt: number;
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

export interface UnitDef {
  id: string; name: string; title?: string;
  archetype?: string;                            // 설계 의도 (화면에는 안 보인다)
  model: string; scale?: number; boss?: boolean;
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

export const HEROES: UnitDef[] = [
  {
    id: 'leon', name: '레온', title: '서약의 기사', archetype: '딜탱 유도형', color: '#e8b64c',
    model: 'Knight', keep: ['1H_Sword', 'Badge_Shield'],
    stats: { hp: 1500, atk: 92, def: 60, spd: 100, crit: 0.08, critDmg: 1.6, healPow: 1, threat: 2.6, range: 1.6, move: 3.6 },
    anims: {
      idle: 'Idle', run: 'Running_A', hit: 'Block_Hit', death: 'Death_A', victory: 'Cheer',
      attack: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'],
      extra: ['Block_Attack', 'Block', 'Blocking'],
    },
    hitAt: 0.38, targeting: 'nearest', rage: 0.4,
    skills: [
      {
        name: '방패 강타', cd: 7, anim: 'Block_Attack', hitAt: 0.3, melee: true,
        run: (b, u) => {
          const t = u.target; if (!t) return;
          b.damage(u, t, 1.4);
          b.stun(t, 1.2);
          u.threat += 400;
          b.fx.ring(t.pos, COL.gold, 1.8, 0.4);
        },
      },
      {
        name: '굳건한 의지', cd: 12, anim: 'Block', hitAt: 0.2,
        can: (_b, u) => u.hp / u.maxHp < 0.8,
        run: (b, u) => {
          b.addDr(u, 0.35, 6);
          b.addShield(u, u.maxHp * 0.08);
          b.fx.bubble(u, COL.gold, 6);
        },
      },
    ],
    ult: {
      name: '수호의 맹세', desc: '적 전체 도발 6초 · 아군 전체 보호막', cutAnim: 'Block',
      run: (b, u) => {
        u.play('Blocking', true);
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
    model: 'Barbarian', keep: ['2H_Axe'],
    stats: { hp: 1200, atk: 150, def: 35, spd: 95, crit: 0.25, critDmg: 1.8, healPow: 0.8, threat: 1.2, range: 1.8, move: 3.8 },
    anims: {
      idle: '2H_Melee_Idle', run: 'Running_A', hit: 'Hit_A', death: 'Death_B', victory: 'Cheer',
      attack: ['2H_Melee_Attack_Slice', '2H_Melee_Attack_Chop'],
      extra: ['2H_Melee_Attack_Spin', '2H_Melee_Attack_Spinning'],
    },
    hitAt: 0.45, targeting: 'nearest',
    skills: [
      {
        name: '대지 가르기', cd: 8, anim: '2H_Melee_Attack_Spin', hitAt: 0.5, melee: true,
        run: (b, u) => {
          const t = u.target; if (!t) return;
          b.damage(u, t, 2.2);
          for (const e of b.near(u.pos, b.foesOf(u), 2.8)) if (e !== t) b.damage(u, e, 0.9);
          b.fx.ring(u.pos, COL.red, 3, 0.35);
        },
      },
    ],
    ult: {
      name: '피의 회오리', desc: '2.4초 동안 주변 적에게 6연타 · 피해의 30% 흡혈', cutAnim: 'Cheer',
      run: (b, u) => {
        u.play('2H_Melee_Attack_Spinning', true, 1.2);
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
    model: 'Mage', keep: ['2H_Staff'],
    stats: { hp: 900, atk: 120, def: 25, spd: 105, crit: 0.1, critDmg: 1.6, healPow: 1.25, threat: 0.8, range: 9, move: 3.2 },
    anims: {
      idle: 'Idle', run: 'Running_B', hit: 'Hit_B', death: 'Death_A', victory: 'Cheer',
      attack: ['Spellcast_Shoot'], extra: ['Spellcast_Raise', 'Spellcast_Long'],
    },
    hitAt: 0.35, projectile: 'magic', targeting: 'nearest',
    skills: [
      {
        name: '치유의 빛', cd: 4.5, anim: 'Spellcast_Raise', hitAt: 0.45,
        can: (b, u) => b.alliesOf(u).some(a => a.hp / a.maxHp < 0.72),
        run: (b, u) => {
          const t = lowestHpRatio(b.alliesOf(u)); if (!t) return;
          b.heal(u, t, 1.9);
        },
      },
    ],
    ult: {
      name: '성광 폭발', desc: '적 전체 피해 · 아군 전체 치유', cutAnim: 'Spellcast_Long',
      run: (b, u) => {
        u.play('Spellcast_Raise', false);
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
    model: 'Rogue_Hooded', keep: ['2H_Crossbow'],
    stats: { hp: 950, atk: 140, def: 28, spd: 120, crit: 0.3, critDmg: 2.0, healPow: 1, threat: 0.7, range: 10, move: 3.6 },
    anims: {
      idle: 'Idle', run: 'Running_A', hit: 'Hit_A', death: 'Death_B', victory: 'Cheer',
      attack: ['2H_Ranged_Shoot'], extra: ['2H_Ranged_Aiming'],
    },
    hitAt: 0.25, projectile: 'bolt', targeting: 'nearest',
    skills: [
      {
        name: '약점 사격', cd: 7, anim: '2H_Ranged_Shoot', hitAt: 0.25,
        run: (b, u) => {
          const t = lowestHpRatio(b.foesOf(u)); if (!t) return;
          u.faceNow(t.pos);
          b.shoot(u, t, 'gold', () => b.damage(u, t, 2.2, { crit: true }));
        },
      },
    ],
    ult: {
      name: '사신의 표식', desc: '고른 적 하나에게 확정 치명 6.5배 · 처치하면 게이지 50% 반환', cutAnim: '2H_Ranged_Aiming', targeted: true,
      run: (b, u, t) => {
        if (!t || !t.alive) return;
        u.faceNow(t.pos);
        u.play('2H_Ranged_Shoot', false);
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
  { id: '1-2', name: '뼈의 회랑', level: 1, waves: [W_SKEL, W_GUARD], reward: { gold: 500, gems: 150 } },
  { id: '1-3', name: '군주의 방', level: 1, waves: [W_SKEL, W_GUARD, W_BOSS], reward: { gold: 900, gems: 300 } },
];

// 레벨에 따른 능력치 배율 (HP·공격·방어에 곱한다)
export const heroMul = (lv: number) => 1 + 0.08 * (lv - 1);
export const enemyMul = (lv: number) => 1 + 0.1 * (lv - 1);

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
