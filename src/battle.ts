// 실시간 자동 전투: 대상 고르기, 이동, 공격·스킬, 필살기 컷인, 웨이브 진행
import { AnimationGroup, Mesh, PBRMaterial, Color3, Scene, ShadowGenerator, TrailMesh, TransformNode, Vector3 } from '@babylonjs/core';
import type { Assets, ModelInstance } from './assets';
import type { CameraRig } from './camera';
import { COL, ENEMIES, FORMATION, enemyMul, type Look, type Outcome, type ProjKind, type SkillDef, type Stage, type UnitDef } from './data';
import { makeHeroModel } from './heroModel';
import { addBonus, zeroBonus, type Bonus } from './items';
import type { Fx } from './fx';
import type { Hud } from './hud';
import { synergy, type Policy } from './tactics';
import { auraOf, ULT_MUL, ultLevel } from './talents';
import { Unit, type Side } from './unit';

/** 통짜 모델(um/…): 크기 맞춤, 그림자, 눈 빛내기 */
export function makeModel(assets: Assets, def: UnitDef, shadow: ShadowGenerator): ModelInstance {
  const m = assets.spawn(def.model, !!def.eyeGlow);
  if (def.fit) m.root.getChildren().forEach(c => (c as TransformNode).scaling.scaleInPlace(def.fit!));
  for (const mesh of m.meshes) {
    shadow.addShadowCaster(mesh, false);
    mesh.isPickable = false;
    const mat = mesh.material as PBRMaterial | null;
    if (mat && 'maxSimultaneousLights' in mat) mat.maxSimultaneousLights = 8;
    // 흰자는 검게, 눈동자는 빛나게: 동글동글한 눈이 귀여워 보이지 않게
    if (def.eyeGlow && mat instanceof PBRMaterial) {
      if (mat.name.startsWith('Eye_White')) { mat.albedoColor = new Color3(0.05, 0.02, 0.02); mat.emissiveColor = new Color3(...def.eyeGlow).scale(0.5); }
      else if (mat.name.startsWith('Eye_Black')) mat.emissiveColor = new Color3(...def.eyeGlow);
    }
  }
  return m;
}

/** 전투에 나서는 영웅 한 명 (loadout.ts) */
export interface Member { def: UnitDef; mul: number; grade?: number; look?: Look; title?: string; bonus?: Bonus; policy?: Policy }

interface Proj { mesh: Mesh; trail: TrailMesh; tgt: Unit; last: Vector3; speed: number; onHit: () => void }
type State = 'load' | 'intro' | 'fight' | 'clear' | 'won' | 'lost';

const ARENA = { x: 8.6, zMin: -11, zMax: 15.5 };
const ATK_ANIM_SPEED = 1.25;
export const SWAP_CD = 10;   // 앞뒤 교대 재사용 (초)

export class Battle {
  units: Unit[] = [];
  time = 0;
  ults = 0;   // 영웅이 쓴 필살기 수 (별 조건)
  fightAt = 0;   // 첫 웨이브가 시작한 시각 (제한 시간)
  swapAt = -SWAP_CD;   // 마지막 앞뒤 교대 시각
  speed = 1;
  paused = false;
  frozen = false;
  state: State = 'load';
  wave = -1;
  targeting: Unit | null = null;
  /** 필살기 자동 사용 */
  auto = false;
  /** 전투가 끝나면 부른다 (승패) */
  onEnd: (win: boolean) => void = () => {};
  private timers: { at: number; fn: () => void }[] = [];
  private projs: Proj[] = [];

  constructor(
    public scene: Scene, private assets: Assets, public fx: Fx, private rig: CameraRig,
    public hud: Hud, private shadow: ShadowGenerator,
    public stage: Stage, private party: Member[],
    private rivals: Member[] = [],   // 모의전: 상대 파티 (적 쪽 영웅)
  ) {}

  get heroes() { return this.units.filter(u => u.side === 'hero'); }
  get waveCount() { return this.stage.waves.length; }
  get waveTitle() {
    if (this.rivals.length) return '모의전';
    if (this.stage.limit) return `${Math.max(0, Math.ceil(this.stage.limit - (this.time - this.fightAt)))}초`;
    return this.stage.waves[this.wave]?.boss ? 'BOSS' : `WAVE ${this.wave + 1}`;
  }
  /** 영웅이 준 피해 합 (레이드) */
  get heroDamage() { return this.heroes.reduce((a, h) => a + h.dmgDone, 0); }
  /** 별 조건을 따질 기록 */
  outcome(win: boolean): Outcome {
    const hs = this.heroes;
    return {
      win, time: this.time, ults: this.ults, size: hs.length,
      deaths: hs.filter(h => !h.alive).length,
      hpPct: hs.reduce((a, h) => a + (h.alive ? h.hp : 0), 0) / hs.reduce((a, h) => a + h.maxHp, 0),
    };
  }

  foesOf(u: Unit) { return this.units.filter(x => x.alive && x.side !== u.side); }
  alliesOf(u: Unit) { return this.units.filter(x => x.alive && x.side === u.side); }
  dist(a: Unit, b: Unit) { return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z); }
  near(p: Vector3, list: Unit[], r: number) { return list.filter(x => Math.hypot(x.pos.x - p.x, x.pos.z - p.z) <= r + x.radius); }
  after(sec: number, fn: () => void) { this.timers.push({ at: this.time + sec, fn }); }
  shake(a: number) { this.rig.shake(a); }

  // ───────── 생성 ─────────

  spawn(def: UnitDef, side: Side, pos: Vector3, yaw: number, mul = 1, look?: Look, bonus?: Bonus): Unit {
    const m = look ? makeHeroModel(this.assets, this.scene, look, this.shadow, this.fx) : makeModel(this.assets, def, this.shadow);
    const u = new Unit(def, side, m, pos, yaw, mul, bonus);
    this.units.push(u);
    this.hud.addBar(u);
    return u;
  }

  /** 적 하나를 세우고 등장 동작을 튼다 (웨이브 시작, 보스의 부하 부르기) */
  spawnEnemy(kind: string, x: number, z: number) {
    const def = ENEMIES[kind];
    const u = this.spawn(def, 'enemy', new Vector3(x, 0, z), Math.PI, enemyMul(this.stage.level), def.looks?.[0]);
    const d = u.play(def.anims.spawn ?? def.anims.idle, false, 1.2);
    u.busyUntil = this.time + d * 0.9;
    return u;
  }

  spawnHeroes() { this.spawnTeam(this.party, 'hero'); }

  /** 파티를 진형대로 세운다. 모의전 상대(enemy)는 맞은편에 거울처럼 선다 */
  private spawnTeam(team: Member[], side: Side) {
    const syn = synergy(team.map(p => p.def.id)).bonus;
    return team.map((p, i) => {
      const f = FORMATION[i];
      const pos = side === 'hero' ? f.clone() : new Vector3(-f.x, 0, 6 - f.z);
      const u = this.spawn(p.def, side, pos, side === 'hero' ? 0 : Math.PI, p.mul, p.look, addBonus(p.bonus ?? zeroBonus(), syn));
      u.title = p.title;
      u.ultMul = ULT_MUL[ultLevel(p.grade ?? 0) - 1];
      u.policy = p.policy ?? 'attack';
      u.slot = i;
      if (!u.has('stealth')) u.threat = u.threatMul() * 150;
      u.play(p.def.anims.idle);
      return u;
    });
  }

  /** 전투 시작 때 파티 전체에 거는 것: 파티 오라, 불멸 장비 고유 효과, 수호자 2차·왕국 대형 시너지 보호막 */
  private teamStart(units: Unit[], team: Member[]) {
    // 파티 오라 (불멸 이상 영웅): 아군 전체 공격력. 여러 명이면 더한다
    const aura = team.reduce((a, p) => a + auraOf(p.grade ?? 0), 0);
    if (aura) for (const h of units) h.buffAtk += aura;
    // 불멸 이상 장비의 고유 효과는 파티 전체에 절반 세기로 (낀 영웅 자신은 이미 가졌다)
    for (const src of units) for (const [id, p] of Object.entries(src.bonus.party))
      for (const h of units) if (h !== src) h.bonus.uniq[id] = (h.bonus.uniq[id] ?? 0) + p;
    for (const h of units) if (h.uq2('guardian')) this.addShield(h, h.maxHp * 0.15);
    for (const h of units) if (h.has('syn_kingdom')) this.addShield(h, h.maxHp * 0.12);
  }

  start() {
    this.teamStart(this.heroes, this.party);
    for (const h of this.heroes) {
      h.pos.z -= 9;
      h.moveTo = h.home.clone();
    }
    this.state = 'intro';
    this.after(2.2, () => this.startWave(0));
  }

  private startWave(i: number) {
    this.wave = i;
    if (i === 0) this.fightAt = this.time;
    // 지난 웨이브의 쓰러진 적 정리
    this.units = this.units.filter(u => u.side === 'hero' || u.alive);
    const w = this.stage.waves[i];
    const boss = w.units.map(([k]) => ENEMIES[k]).find(d => d.boss);
    this.hud.banner(this.waveTitle, boss?.name ?? '', !!w.boss);
    for (const [kind, x, z] of w.units) {
      const u = this.spawnEnemy(kind, x, z);
      this.fx.burst(u.pos.add(new Vector3(0, 0.2, 0)), COL.bone, 18, 3, 0.25);
    }
    if (i === 0 && this.rivals.length) {
      const rs = this.spawnTeam(this.rivals, 'enemy');
      this.teamStart(rs, this.rivals);
      for (const u of rs) this.fx.burst(u.pos.add(new Vector3(0, 0.2, 0)), COL.red, 18, 3, 0.25);
    }
    if (w.boss) this.shake(0.4);
    for (const h of this.heroes) if (h.alive && h.uq('shade') && (i === 0 || h.uq2('shade'))) { h.shadeUntil = this.time + 6; h.shadeHit = true; }
    this.state = 'fight';
  }

  // ───────── 매 프레임 ─────────

  update(realDt: number) {
    const dt = this.paused || this.frozen ? 0 : Math.min(realDt, 0.05) * this.speed;
    if (dt > 0) {
      this.time += dt;
      const due = this.timers.filter(x => x.at <= this.time);
      this.timers = this.timers.filter(x => x.at > this.time);
      due.forEach(x => x.fn());
      if (this.state === 'fight') for (const u of this.units) this.think(u);
      for (const u of this.units) this.tick(u, dt);
      this.separate();
      this.updateProjs(dt);
      this.fx.update(dt);
      if (this.state === 'fight') this.checkEnd();
      if (this.auto && this.state === 'fight' && !this.frozen && !this.targeting) this.autoUlt();
    }
    this.hud.update(this);
  }

  private tick(u: Unit, dt: number) {
    if (!u.alive) return;
    for (let i = 0; i < u.cds.length; i++) u.cds[i] -= dt;
    u.atkCd -= dt;
    u.threat *= 1 - 0.06 * dt;
    if (this.state === 'fight' && u.def.ult) u.gauge = Math.min(100, u.gauge + dt * ((u.side === 'hero' || u.def.maxGrade !== undefined ? 3.5 : 5) * (1 + u.bonus.gaugePct) + 2 * u.uq('focus')));
    if (this.time < u.shadeUntil) u.threat = 0;   // 고유 그림자 망토
    // 고유 재생의 갑옷: 3초마다
    if (u.uq('regen') && this.state === 'fight' && this.time >= u.regenAt) {
      u.regenAt = this.time + 3;
      if (u.hp < u.maxHp) this.healFlat(u, u, u.maxHp * 0.03 * u.uq('regen') * (u.uq2('regen') && u.hp / u.maxHp < 0.3 ? 2 : 1));
    }
    const busy = this.time < u.busyUntil;
    if (!busy && u.moveTo) {
      const dx = u.moveTo.x - u.pos.x, dz = u.moveTo.z - u.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) {
        u.moveTo = null;
        if (this.state !== 'fight') u.face(u.pos.add(new Vector3(0, 0, u.side === 'hero' ? 1 : -1)));
      } else {
        const step = Math.min(d, u.def.stats.move * dt);
        u.pos.x += (dx / d) * step;
        u.pos.z += (dz / d) * step;
        u.face(u.moveTo);
        u.play(u.def.anims.run, true, u.side === 'hero' ? 1.1 : 1);
      }
    }
    if (!busy && !u.moveTo) u.play(u.def.anims.idle);
    u.turn(dt);
  }

  private think(u: Unit) {
    if (!u.alive || this.time < u.busyUntil) return;
    const foes = this.foesOf(u);
    if (!foes.length) { u.moveTo = null; return; }
    // 행동 방침 생존 우선: 체력이 40% 아래면 잠깐 뒤로 (10초에 한 번)
    if (u.policy === 'survive' && u.hp / u.maxHp < 0.4 && this.time >= u.retreatAt) {
      u.retreatAt = this.time + 10;
      u.threat *= 0.5;
      u.target = null;
      u.holdTo = new Vector3(u.home.x, 0, u.home.z + (u.side === 'hero' ? -2.5 : 2.5));
      u.holdUntil = this.time + 2;
    }
    // 앞뒤 교대·후퇴: 정한 자리로 걸어간다
    if (this.time < u.holdUntil && u.holdTo) {
      u.moveTo = Math.hypot(u.holdTo.x - u.pos.x, u.holdTo.z - u.pos.z) > 0.1 ? u.holdTo.clone() : null;
      return;
    }
    if (!u.target || !u.target.alive || this.time >= u.retargetAt) {
      u.target = this.pickTarget(u, foes);
      u.retargetAt = this.time + 1.2;
    }
    if (u.tauntBy && u.tauntBy.alive && this.time < u.tauntUntil) u.target = u.tauntBy;
    const t = u.target!;
    const inRange = this.dist(u, t) <= u.def.stats.range + t.radius + u.radius * 0.5;

    for (let i = 0; i < u.def.skills.length; i++) {
      const s = u.def.skills[i];
      if (u.cds[i] > 0 || (s.melee && !inRange) || (s.can && !s.can(this, u))) continue;
      this.castSkill(u, s, i);
      return;
    }
    if (u.side === 'enemy' && u.def.ult && u.gauge >= 100) {
      u.gauge = 0;
      // 모의전 상대 영웅: 컷인 없이 쓴다 (대상 지정형은 지금 대상에게)
      if (u.def.maxGrade !== undefined) {
        u.face(t.pos);
        u.busyUntil = this.time + u.play(u.def.ult.cutAnim, false, 1.2) * 0.8;
        u.ultUntil = this.time + 5;
        this.fx.ring(u.pos, COL.red, 1.4, 0.4);
      }
      u.def.ult.run(this, u, u.def.ult.targeted ? t : undefined);
      return;
    }
    if (inRange) {
      u.moveTo = null;
      u.face(t.pos);
      if (u.atkCd <= 0) this.basicAttack(u, t);
    } else {
      u.moveTo = t.pos.clone();
    }
  }

  private pickTarget(u: Unit, foes: Unit[]): Unit {
    const by = (score: (f: Unit) => number) => foes.reduce((a, b) => (score(b) > score(a) ? b : a));
    // 행동 방침 (tactics.ts)
    if (u.policy === 'weak') return by(f => -f.hp - this.dist(u, f));
    if (u.policy === 'protect') {
      const mates = this.alliesOf(u).filter(a => a !== u);
      const hurt = mates.length ? mates.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a)) : null;
      const near = foes.filter(f => f.target === hurt);
      if (hurt && near.length) return near.reduce((a, b) => (this.dist(u, b) < this.dist(u, a) ? b : a));
    }
    if (u.def.targeting === 'lowest') return by(f => -f.hp / f.maxHp);
    if (u.def.targeting === 'threat') {
      const ranged = u.def.stats.range > 4;
      const score = (f: Unit) => f.threat - this.dist(u, f) * (ranged ? 4 : 18);
      const best = by(score);
      if (u.target?.alive && score(best) < score(u.target) * 1.25 + 30) return u.target;
      return best;
    }
    return by(f => -this.dist(u, f));
  }

  private basicAttack(u: Unit, t: Unit) {
    const lonely = u.uq('lonely') && this.alliesOf(u).length <= 2;
    const fast = (lonely ? 0.2 : 0) + (u.uq2('shade') && this.time < u.shadeUntil ? 0.3 : 0);
    const interval = 1.7 * (100 / u.spd()) / (1 + fast);
    const anim = u.def.anims.attack[Math.floor(Math.random() * u.def.anims.attack.length)];
    const dur = u.play(anim, false, ATK_ANIM_SPEED);
    u.atkCd = interval;
    u.busyUntil = this.time + Math.min(dur, interval * 0.85);
    this.after(u.def.hitAt / ATK_ANIM_SPEED, () => {
      if (!u.alive || !t.alive) return;
      // 특성 파편: 대상 주변 적에게도 30%
      const cleave = () => { if (u.has('cleave')) for (const f of this.near(t.pos, this.foesOf(u), 2.2)) if (f !== t) this.damage(u, f, 0.3, { noGauge: true }); };
      // 고유 연쇄 번개: 근처 다른 적에게 튄다
      const arc = () => {
        if (!u.uq('arc') || Math.random() >= (u.uq2('arc') ? 0.5 : 0.3)) return;
        const o = this.near(t.pos, this.foesOf(u), 4).find(f => f !== t);
        if (o) { this.damage(u, o, 0.5 * u.uq('arc'), { noGauge: true }); this.fx.burst(o.chest(), COL.blue, 14, 4, 0.2); }
      };
      // 광풍 4세트: 3번마다 한 번 더
      const again = () => { if (u.has('set_storm') && ++u.atkCount % 3 === 0) this.after(0.15, () => { if (u.alive && t.alive) this.damage(u, t, 1, { noGauge: true }); }); };
      if (u.def.projectile) this.shoot(u, t, u.def.projectile, () => { this.damage(u, t, 1); cleave(); arc(); again(); });
      else {
        this.damage(u, t, 1);
        cleave();
        arc();
        again();
        this.fx.slash(t.chest(), u.side === 'hero' ? COL.white : COL.red);
      }
    });
  }

  private castSkill(u: Unit, s: SkillDef, i: number) {
    // 특성: 재사용 단축, 연속 기술(25% 로 바로 다시)
    u.cds[i] = u.has('chain') && Math.random() < 0.25 ? 0.5 : s.cd * (1 - Math.min(0.5, u.bonus.cdr));
    if (u.target) u.face(u.target.pos);
    const dur = u.play(s.anim, false, 1.1);
    u.busyUntil = this.time + dur * 0.9;
    this.after(s.hitAt / 1.1, () => {
      if (!u.alive) return;
      s.run(this, u);
      if (u.has('embers') && u.target?.alive) { this.dot(u, u.target, 0.15, 3); this.fx.burst(u.target.chest(), COL.red, 10, 3, 0.2); }   // 특성 잔불
    });
  }

  // ───────── 전투 처리 ─────────

  damage(src: Unit, tgt: Unit, mult: number, o: { crit?: boolean; lifesteal?: number; noGauge?: boolean; reflect?: boolean } = {}) {
    if (!tgt.alive) return 0;
    const atk = src.atk();
    let raw = Math.max(atk * mult * 0.15, atk * mult - tgt.defense() * 0.5);
    const crit = o.crit ?? (src.firstCrit || this.time < src.critUntil || Math.random() < src.critRate());
    src.firstCrit = false;
    if (crit) raw *= src.critDmg();
    if (src.has('execute') && tgt.hp / tgt.maxHp < 0.3) raw *= 1.4;   // 특성 처형
    // 장비 고유 효과 (uniques.ts)
    if (src.uq('reaper') && tgt.hp / tgt.maxHp < 0.25) raw *= 1 + 0.5 * src.uq('reaper');
    if (src.uq('lonely') && this.alliesOf(src).length <= 2) raw *= 1 + 0.4 * src.uq('lonely');
    if (src.uq2('inverse') && this.alliesOf(src).every(a => a.hp >= a.maxHp)) raw *= 1.25;
    if (src.shadeHit && !o.reflect) { raw *= 1 + src.uq('shade'); src.shadeHit = false; }
    if (tgt.uq2('lonely') && this.alliesOf(tgt).length === 1) raw *= 0.7;
    if (src.ultUntil > this.time) raw *= src.ultMul;                   // 필살기 단계
    raw *= (1 - tgt.dr(this.time)) * (0.92 + Math.random() * 0.16);
    const dmg = Math.max(1, Math.round(raw));
    // 철벽 4세트: 다른 아군이 받는 피해의 20% 를 대신 받는다 (이것으로는 쓰러지지 않는다)
    const iron = o.reflect || tgt.has('set_iron') ? undefined : this.alliesOf(tgt).find(x => x !== tgt && x.has('set_iron'));
    const taken = iron ? Math.round(dmg * 0.2) : 0;
    if (iron) { iron.hp = Math.max(1, iron.hp - Math.round(taken * (1 - iron.dr(this.time)))); iron.dmgTaken += taken; }
    const absorbed = Math.min(tgt.shield, dmg - taken);
    tgt.shield -= absorbed;
    tgt.hp -= dmg - taken - absorbed;
    src.dmgDone += dmg;
    tgt.dmgTaken += dmg;
    src.threat += dmg * src.threatMul();
    if (!o.noGauge && src.def.ult) src.gauge = Math.min(100, src.gauge + 4 * (1 + src.bonus.gaugePct));
    if (tgt.def.ult) tgt.gauge = Math.min(100, tgt.gauge + 2 * (1 + tgt.bonus.gaugePct));
    this.hud.number(tgt, dmg, absorbed === dmg ? 'block' : crit ? 'crit' : tgt.side === 'hero' ? 'taken' : 'dmg');
    this.fx.burst(tgt.chest(), crit ? COL.gold : tgt.side === 'hero' ? COL.red : COL.white, crit ? 22 : 12, crit ? 6 : 4);
    if (crit) this.shake(0.12);
    const ls = (o.lifesteal ?? 0) + src.bonus.lifesteal + 0.08 * src.uq('vamp');
    if (ls) this.healFlat(src, src, dmg * ls, src.uq2('vamp'));
    if (crit && src.uq('keen') && src.def.ult) src.gauge = Math.min(100, src.gauge + 5 * src.uq('keen'));
    // 고유 피의 서약: 체력이 가장 낮은 아군 치유
    if (src.uq('bloodpact') && !o.reflect) {
      const low = this.alliesOf(src).reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
      this.healFlat(src, low, dmg * 0.15 * src.uq('bloodpact') * (src.uq2('bloodpact') && low.hp / low.maxHp < 0.3 ? 2 : 1));
    }
    // 고유 반사 방패: 거리 상관없이 되돌린다
    if (!o.reflect && tgt.uq('bulwark') && tgt.alive && src.alive) {
      const k = 0.15 * tgt.uq('bulwark') * (tgt.uq2('bulwark') && tgt.hp / tgt.maxHp < 0.5 ? 2 : 1);
      this.damage(tgt, src, (dmg * k) / Math.max(1, tgt.atk()), { crit: false, noGauge: true, reflect: true });
    }
    // 특성 가시: 가까이서 맞으면 20% 를 되돌린다 (되돌린 피해는 다시 되돌리지 않는다)
    if (!o.reflect && tgt.has('thorns') && tgt.alive && this.dist(src, tgt) < 3.5) this.damage(tgt, src, (dmg * 0.2) / Math.max(1, tgt.atk()), { crit: false, noGauge: true, reflect: true });
    // 특성 불굴: 처음으로 HP 30% 아래가 되면
    if (tgt.hp > 0 && tgt.has('unbroken') && !tgt.unbrokenUsed && tgt.hp / tgt.maxHp < 0.3) {
      tgt.unbrokenUsed = true;
      this.addDr(tgt, 0.5, 5);
      this.addShield(tgt, tgt.maxHp * 0.2);
      this.fx.bubble(tgt, COL.gold, 5);
    }
    // 고유 불사의 갑옷: 한 번 버틴다
    if (tgt.hp <= 0 && tgt.uq('undying') && !tgt.undyingUsed) {
      tgt.undyingUsed = true;
      tgt.hp = Math.round(tgt.maxHp * 0.3 * tgt.uq('undying'));
      this.fx.bubble(tgt, COL.gold, 2);
      if (tgt.uq2('undying')) for (const f of this.near(tgt.pos, this.foesOf(tgt), 3)) this.stun(f, 2);
    }
    if (tgt.hp <= 0) {
      this.kill(tgt);
      if (src.has('thirst') && src.alive) this.healFlat(src, src, src.maxHp * 0.15);   // 특성 피의 갈증
      if (src.uq2('reaper') && src.def.ult) src.gauge = Math.min(100, src.gauge + 15);
      if (src.has('syn_abyss') && src.def.ult) src.gauge = Math.min(100, src.gauge + 15);   // 심연 대형 시너지
      if (src.uq2('gale') && src.alive) this.buff(src, 0, 30, 3);
    }
    else if (this.time >= tgt.busyUntil && !tgt.def.boss && Math.random() < 0.3) {
      const d = tgt.play(tgt.def.anims.hit, false, 1.4);
      tgt.busyUntil = this.time + d * 0.7;
    }
    return dmg;
  }

  heal(src: Unit, tgt: Unit, mult: number) {
    const s = src.def.stats;
    const um = src.ultUntil > this.time ? src.ultMul : 1;
    const v = src.atk() * mult * s.healPow * (1 + src.bonus.healPct) * um * (0.95 + Math.random() * 0.1);
    this.healFlat(src, tgt, v);
    this.fx.heal(tgt);
    // 고유 역천의 지팡이: 치유량의 일부로 가장 가까운 적을 친다
    const foes = this.foesOf(src);
    if (src.uq('inverse') && foes.length) {
      const f = foes.reduce((a, b) => (this.dist(src, b) < this.dist(src, a) ? b : a));
      this.damage(src, f, (v * 0.4 * src.uq('inverse')) / Math.max(1, src.atk()), { noGauge: true });
    }
  }

  /** toShield: 넘친 치유를 보호막으로 (고유 흡혈 반지 2차) */
  private healFlat(src: Unit, tgt: Unit, amount: number, toShield = false) {
    if (!tgt.alive) return;
    const v = Math.round(amount);
    const real = Math.min(v, tgt.maxHp - tgt.hp);
    tgt.hp += real;
    src.healDone += real;
    src.threat += real * 0.5 * src.threatMul();
    if (src.has('overflow') && v > real) this.addShield(tgt, (v - real) * 0.5);   // 특성 넘치는 생명
    if (toShield && v > real) this.addShield(tgt, v - real);
    if (v > 0) this.hud.number(tgt, v, 'heal');
  }

  addShield(u: Unit, v: number) { u.shield = Math.min(u.maxHp * 0.6, u.shield + v); }
  addDr(u: Unit, v: number, sec: number) { u.drs.push({ v, until: this.time + sec }); }
  taunt(e: Unit, by: Unit, sec: number) { e.tauntBy = by; e.tauntUntil = this.time + sec; e.target = by; }
  /** sec 초 동안 공격력 배율·공격 속도를 올린다 */
  buff(u: Unit, atk: number, spd: number, sec: number) { u.buffAtk += atk; u.buffSpd += spd; this.after(sec, () => { u.buffAtk -= atk; u.buffSpd -= spd; }); }
  /** n 번, every 초마다 mult 피해 (불·독) */
  dot(src: Unit, tgt: Unit, mult: number, n: number, every = 1) { for (let i = 1; i <= n; i++) this.after(i * every, () => { if (src.alive) this.damage(src, tgt, mult, { noGauge: true }); }); }

  stun(t: Unit, sec: number) {
    if (!t.alive || t.def.boss) return;
    t.play(t.def.anims.hit, false, 0.8);
    t.busyUntil = Math.max(t.busyUntil, this.time + sec);
    t.moveTo = null;
  }

  private kill(u: Unit) {
    u.alive = false;
    u.hp = 0;
    u.shield = 0;
    u.moveTo = null;
    // 고유 희생의 문장: 남은 아군이 강해진다 (낀 영웅이 살아 있든 쓰러졌든)
    const mates = this.units.filter(x => x.side === u.side && x !== u);
    const sac = mates.concat(u).reduce((a, x) => a + x.uq('sacrifice'), 0);
    if (sac) for (const m of mates.filter(x => x.alive)) {
      m.buffAtk += 0.15 * sac;
      if (mates.concat(u).some(x => x.uq2('sacrifice'))) this.healFlat(m, m, m.maxHp * 0.2);
    }
    u.play(u.def.anims.death, false);
    this.hud.removeBar(u);
    if (u.side === 'enemy') {
      this.fx.burst(u.chest(), COL.bone, 26, 5, 0.25);
      this.after(2.2, () => this.fx.tween(0.9, k => (u.pos.y = -k * 1.6 * u.scale), () => u.model.dispose()));
    }
  }

  shoot(src: Unit, tgt: Unit, kind: ProjKind, onHit: () => void, scale = 1, speed = 18) {
    const { mesh, trail } = this.fx.projectile(kind, scale);
    mesh.position.copyFrom(src.muzzle());
    mesh.lookAt(tgt.chest());
    this.projs.push({ mesh, trail, tgt, last: tgt.chest(), speed, onHit });
  }

  private updateProjs(dt: number) {
    this.projs = this.projs.filter(p => {
      const dest = p.tgt.alive ? p.tgt.chest() : p.last;
      p.last = dest;
      const dir = dest.subtract(p.mesh.position);
      const d = dir.length();
      const step = p.speed * dt;
      if (d <= step + 0.05) {
        p.mesh.dispose();
        p.trail.dispose();
        if (p.tgt.alive) p.onHit();
        return false;
      }
      p.mesh.position.addInPlace(dir.scale(step / d));
      p.mesh.lookAt(dest);
      return true;
    });
  }

  private separate() {
    const live = this.units.filter(u => u.alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = a.radius + b.radius;
        const d = Math.hypot(dx, dz);
        if (d >= min || d < 1e-4) continue;
        const push = (min - d) * 0.5;
        const wa = a.def.boss ? 0.1 : 1, wb = b.def.boss ? 0.1 : 1;
        a.pos.x -= (dx / d) * push * wa; a.pos.z -= (dz / d) * push * wa;
        b.pos.x += (dx / d) * push * wb; b.pos.z += (dz / d) * push * wb;
      }
    }
    for (const u of live) {
      u.pos.x = Math.max(-ARENA.x, Math.min(ARENA.x, u.pos.x));
      u.pos.z = Math.max(ARENA.zMin, Math.min(ARENA.zMax, u.pos.z));
    }
  }

  private checkEnd() {
    // 제한 시간 (레이드): 다 되면 그때까지로 끝
    if (this.stage.limit && this.time - this.fightAt >= this.stage.limit) {
      this.state = 'won';
      for (const u of this.units) { u.moveTo = null; u.busyUntil = this.time + 9; if (u.alive) u.play(u.def.anims.idle); }
      this.hud.banner('시간 종료', `피해량 ${Math.round(this.heroDamage).toLocaleString()}`);
      this.after(2.4, () => this.onEnd(true));
      return;
    }
    if (!this.heroes.some(h => h.alive)) {
      this.state = 'lost';
      this.after(1.6, () => this.onEnd(false));
      return;
    }
    if (this.units.some(u => u.side === 'enemy' && u.alive)) return;
    this.state = 'clear';
    const last = this.wave === this.stage.waves.length - 1;
    for (const h of this.heroes.filter(x => x.alive)) {
      h.moveTo = null;
      h.target = null;
      h.drs = [];
      const d = h.play(h.def.anims.victory ?? h.def.anims.idle, false);
      h.busyUntil = this.time + d;
      if (!last) this.healFlat(h, h, h.maxHp * 0.2);
    }
    if (last) {
      this.state = 'won';
      this.hud.banner('승리', this.stage.name);
      this.after(2.4, () => this.onEnd(true));
      return;
    }
    this.after(1.6, () => this.heroes.filter(h => h.alive).forEach(h => (h.moveTo = h.home.clone())));
    this.after(3.2, () => this.startWave(this.wave + 1));
  }

  // ───────── 앞뒤 교대 ─────────

  canSwap() { return this.state === 'fight' && !this.frozen && !this.paused && this.time - this.swapAt >= SWAP_CD && this.heroes.length > 1; }
  swapLeft() { return Math.max(0, SWAP_CD - (this.time - this.swapAt)); }

  /** 앞줄(0·1)과 뒷줄(2·3)을 바꾼다. 앞으로 나간 영웅은 위협이 커지고, 뒤로 빠진 영웅은 줄어든다 */
  swapRows() {
    if (!this.canSwap()) return;
    this.swapAt = this.time;
    for (const h of this.heroes) {
      h.slot ^= 2;
      h.home = FORMATION[h.slot].clone();
      if (!h.alive) continue;
      h.threat *= h.slot < 2 ? 1.5 : 0.4;
      h.target = null;
      h.holdTo = h.home.clone();
      h.holdUntil = this.time + 1.5;
      this.fx.ring(h.pos, COL.gold, 1, 0.3);
    }
  }

  // ───────── 필살기 ─────────

  requestUlt(i: number) {
    const u = this.heroes[i];
    if (!u || !u.alive || u.gauge < 100 || this.frozen || this.paused || this.state !== 'fight') return;
    if (this.targeting === u) { this.targeting = null; this.hud.hint(false); return; }
    if (u.def.ult!.targeted) { this.targeting = u; this.hud.hint(true); return; }
    void this.castUlt(u);
  }

  /** 게이지가 찬 영웅의 필살기를 쓴다. 대상이 필요하면 보스, 없으면 HP 가 가장 많은 적 */
  private autoUlt() {
    const h = this.heroes.find(x => x.alive && x.gauge >= 100);
    if (!h) return;
    if (!h.def.ult!.targeted) { void this.castUlt(h); return; }
    const foes = this.foesOf(h);
    const t = foes.find(f => f.def.boss) ?? foes.reduce<Unit | null>((m, f) => (!m || f.hp > m.hp ? f : m), null);
    if (t) void this.castUlt(h, t);
  }

  /** 조준 중일 때 화면 탭: 가장 가까운 적을 고른다 */
  tapAt(x: number, y: number) {
    const u = this.targeting;
    if (!u) return;
    let best: Unit | null = null, bestD = 90;
    for (const e of this.foesOf(u)) {
      const p = this.hud.project(e.chest());
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = e; }
    }
    this.targeting = null;
    this.hud.hint(false);
    if (best && u.alive && u.gauge >= 100) void this.castUlt(u, best);
  }

  private async castUlt(u: Unit, target?: Unit) {
    const ult = u.def.ult!;
    u.gauge = 0;
    if (u.side === 'hero') this.ults++;
    const mates = this.alliesOf(u).filter(x => x !== u);
    if (u.uq2('focus')) u.critUntil = this.time + 3;
    const gain = 20 * u.uq('resonance') + (u.has('set_star') ? 15 : 0);
    if (gain) for (const m of mates) if (m.def.ult) m.gauge = Math.min(100, m.gauge + gain);
    if (u.uq2('resonance')) for (const m of this.alliesOf(u)) this.buff(m, 0.15, 0, 5);
    if (u.has('set_sanct')) for (const m of this.alliesOf(u)) this.healFlat(u, m, m.maxHp * 0.1);
    this.frozen = true;
    this.scene.animationTimeScale = 1;
    const paused: AnimationGroup[] = [];
    const others = this.units.filter(x => x !== u && !x.model.root.isDisposed());
    for (const x of others) {
      if (x.curAnim?.isPlaying) { x.curAnim.pause(); paused.push(x.curAnim); }
      x.root.setEnabled(false);   // 컷인 구도를 가리지 않게
    }
    this.projs.forEach(p => { p.mesh.setEnabled(false); p.trail.setEnabled(false); });
    if (target) u.faceNow(target.pos);
    else if (u.target?.alive) u.faceNow(u.target.pos);
    u.play(ult.cutAnim, false, 1);
    this.hud.cutin(u);
    await this.rig.cutin(u);
    others.forEach(x => { if (!x.model.root.isDisposed()) x.root.setEnabled(true); });
    this.projs.forEach(p => { p.mesh.setEnabled(true); p.trail.setEnabled(true); });
    paused.forEach(g => g.play());
    this.scene.animationTimeScale = this.paused ? 0 : this.speed;
    this.frozen = false;
    u.busyUntil = this.time + 0.4;
    u.ultUntil = this.time + 5;   // 필살기가 뒤에 이어 거는 피해(after)까지 단계 배율을 준다
    if (u.alive) ult.run(this, u, target);
    if (u.alive && u.has('inspire')) for (const a of this.alliesOf(u)) { this.buff(a, 0.15, 0, 6); this.fx.ring(a.pos, COL.gold, 1.2, 0.4); }   // 특성 고무
  }

  /** 전투를 끝내고 만든 것을 모두 치운다 */
  dispose() {
    this.timers = [];
    this.projs.forEach(p => { p.mesh.dispose(); p.trail.dispose(); });
    this.projs = [];
    this.fx.clear();
    for (const u of this.units) if (!u.model.root.isDisposed()) u.model.dispose();
    this.units = [];
    this.hud.reset();
    this.scene.animationTimeScale = 1;
  }

  setSpeed(s: number) {
    this.speed = s;
    if (!this.paused && !this.frozen) this.scene.animationTimeScale = s;
  }

  togglePause() {
    this.paused = !this.paused;
    if (!this.frozen) this.scene.animationTimeScale = this.paused ? 0 : this.speed;
    return this.paused;
  }
}
