// 실시간 자동 전투: 대상 고르기, 이동, 공격·스킬, 필살기 컷인, 웨이브 진행
import { AnimationGroup, Mesh, PBRMaterial, Color3, Scene, ShadowGenerator, TrailMesh, Vector3 } from '@babylonjs/core';
import type { Assets, ModelInstance } from './assets';
import type { CameraRig } from './camera';
import { COL, ENEMIES, FORMATION, enemyMul, type Look, type ProjKind, type SkillDef, type Stage, type UnitDef } from './data';
import { makeHeroModel } from './heroModel';
import type { Fx } from './fx';
import type { Hud } from './hud';
import { Unit, type Side } from './unit';

const WEAPONS = new Set([
  '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword',
  'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', '1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe',
  'Mug', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable',
]);
const isWeapon = (name: string) => [...WEAPONS].find(w => name === w || name.startsWith(`${w}_primitive`));

/** 무기 고르기·붙이기, 그림자, 보스 색까지 마친 모델 (전투와 로비가 같이 쓴다) */
export function makeModel(assets: Assets, def: UnitDef, shadow: ShadowGenerator): ModelInstance {
  const m = assets.spawn(def.model, !!def.boss);
  if (def.keep) {
    const keep = new Set(def.keep);
    for (const mesh of [...m.meshes]) {
      const w = isWeapon(mesh.name);
      if (w && !keep.has(w)) { mesh.dispose(); m.meshes.splice(m.meshes.indexOf(mesh), 1); }
    }
  }
  for (const a of def.attach ?? []) {
    const slot = m.find(a.slot);
    const w = assets.spawn(a.mesh);
    w.root.parent = slot ?? m.root;
    m.meshes.push(...w.meshes);
  }
  for (const mesh of m.meshes) {
    shadow.addShadowCaster(mesh, false);
    mesh.isPickable = false;
    const mat = mesh.material as PBRMaterial | null;
    if (mat && 'maxSimultaneousLights' in mat) mat.maxSimultaneousLights = 8;
    if (def.boss && mat instanceof PBRMaterial) {
      if (mat.name === 'Glow') mat.emissiveColor = new Color3(1, 0.12, 0.05);
      else mat.albedoColor = new Color3(0.8, 0.62, 0.7);
    }
  }
  return m;
}

interface Proj { mesh: Mesh; trail: TrailMesh; tgt: Unit; last: Vector3; speed: number; onHit: () => void }
type State = 'load' | 'intro' | 'fight' | 'clear' | 'won' | 'lost';

const ARENA = { x: 8.6, zMin: -11, zMax: 15.5 };
const ATK_ANIM_SPEED = 1.25;

export class Battle {
  units: Unit[] = [];
  time = 0;
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
    public stage: Stage, private party: { def: UnitDef; mul: number; look?: Look; title?: string }[],
  ) {}

  get heroes() { return this.units.filter(u => u.side === 'hero'); }
  get waveCount() { return this.stage.waves.length; }
  get waveTitle() { return this.stage.waves[this.wave]?.boss ? 'BOSS' : `WAVE ${this.wave + 1}`; }
  foesOf(u: Unit) { return this.units.filter(x => x.alive && x.side !== u.side); }
  alliesOf(u: Unit) { return this.units.filter(x => x.alive && x.side === u.side); }
  dist(a: Unit, b: Unit) { return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z); }
  near(p: Vector3, list: Unit[], r: number) { return list.filter(x => Math.hypot(x.pos.x - p.x, x.pos.z - p.z) <= r + x.radius); }
  after(sec: number, fn: () => void) { this.timers.push({ at: this.time + sec, fn }); }
  shake(a: number) { this.rig.shake(a); }

  // ───────── 생성 ─────────

  spawn(def: UnitDef, side: Side, pos: Vector3, yaw: number, mul = 1, look?: Look): Unit {
    const m = look ? makeHeroModel(this.assets, this.scene, look, this.shadow, this.fx) : makeModel(this.assets, def, this.shadow);
    const u = new Unit(def, side, m, pos, yaw, mul);
    this.units.push(u);
    this.hud.addBar(u);
    return u;
  }

  spawnHeroes() {
    this.party.forEach((p, i) => {
      const u = this.spawn(p.def, 'hero', FORMATION[i], 0, p.mul, p.look);
      u.title = p.title;
      u.play(p.def.anims.idle);
    });
  }

  start() {
    for (const h of this.heroes) {
      h.pos.z -= 9;
      h.moveTo = h.home.clone();
    }
    this.state = 'intro';
    this.after(2.2, () => this.startWave(0));
  }

  private startWave(i: number) {
    this.wave = i;
    // 지난 웨이브의 쓰러진 적 정리
    this.units = this.units.filter(u => u.side === 'hero' || u.alive);
    const w = this.stage.waves[i];
    this.hud.banner(this.waveTitle, w.boss ? ENEMIES.boss.name : '', !!w.boss);
    for (const [kind, x, z] of w.units) {
      const u = this.spawn(ENEMIES[kind], 'enemy', new Vector3(x, 0, z), Math.PI, enemyMul(this.stage.level));
      const d = u.play(u.def.anims.spawn ?? u.def.anims.idle, false, 1.2);
      u.busyUntil = this.time + d * 0.9;
      this.fx.burst(u.pos.add(new Vector3(0, 0.2, 0)), COL.bone, 18, 3, 0.25);
    }
    if (w.boss) this.shake(0.4);
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
    if (this.state === 'fight' && u.def.ult) u.gauge = Math.min(100, u.gauge + dt * (u.side === 'hero' ? 3.5 : 5));
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
      u.def.ult.run(this, u);
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
    const interval = 1.7 * (100 / u.def.stats.spd);
    const anim = u.def.anims.attack[Math.floor(Math.random() * u.def.anims.attack.length)];
    const dur = u.play(anim, false, ATK_ANIM_SPEED);
    u.atkCd = interval;
    u.busyUntil = this.time + Math.min(dur, interval * 0.85);
    this.after(u.def.hitAt / ATK_ANIM_SPEED, () => {
      if (!u.alive || !t.alive) return;
      if (u.def.projectile) this.shoot(u, t, u.def.projectile, () => this.damage(u, t, 1));
      else {
        this.damage(u, t, 1);
        this.fx.slash(t.chest(), u.side === 'hero' ? COL.white : COL.red);
      }
    });
  }

  private castSkill(u: Unit, s: SkillDef, i: number) {
    u.cds[i] = s.cd;
    if (u.target) u.face(u.target.pos);
    const dur = u.play(s.anim, false, 1.1);
    u.busyUntil = this.time + dur * 0.9;
    this.after(s.hitAt / 1.1, () => { if (u.alive) s.run(this, u); });
  }

  // ───────── 전투 처리 ─────────

  damage(src: Unit, tgt: Unit, mult: number, o: { crit?: boolean; lifesteal?: number; noGauge?: boolean } = {}) {
    if (!tgt.alive) return 0;
    const s = src.def.stats;
    const atk = src.atk();
    let raw = Math.max(atk * mult * 0.15, atk * mult - tgt.defense() * 0.5);
    const crit = o.crit ?? Math.random() < s.crit;
    if (crit) raw *= s.critDmg;
    raw *= (1 - tgt.dr(this.time)) * (0.92 + Math.random() * 0.16);
    const dmg = Math.max(1, Math.round(raw));
    const absorbed = Math.min(tgt.shield, dmg);
    tgt.shield -= absorbed;
    tgt.hp -= dmg - absorbed;
    src.dmgDone += dmg;
    tgt.dmgTaken += dmg;
    src.threat += dmg * s.threat;
    if (!o.noGauge && src.def.ult) src.gauge = Math.min(100, src.gauge + 4);
    if (tgt.def.ult) tgt.gauge = Math.min(100, tgt.gauge + 2);
    this.hud.number(tgt, dmg, absorbed === dmg ? 'block' : crit ? 'crit' : tgt.side === 'hero' ? 'taken' : 'dmg');
    this.fx.burst(tgt.chest(), crit ? COL.gold : tgt.side === 'hero' ? COL.red : COL.white, crit ? 22 : 12, crit ? 6 : 4);
    if (crit) this.shake(0.12);
    if (o.lifesteal) this.healFlat(src, src, dmg * o.lifesteal);
    if (tgt.hp <= 0) this.kill(tgt);
    else if (this.time >= tgt.busyUntil && !tgt.def.boss && Math.random() < 0.3) {
      const d = tgt.play(tgt.def.anims.hit, false, 1.4);
      tgt.busyUntil = this.time + d * 0.7;
    }
    return dmg;
  }

  heal(src: Unit, tgt: Unit, mult: number) {
    const s = src.def.stats;
    this.healFlat(src, tgt, src.atk() * mult * s.healPow * (0.95 + Math.random() * 0.1));
    this.fx.heal(tgt);
  }

  private healFlat(src: Unit, tgt: Unit, amount: number) {
    if (!tgt.alive) return;
    const v = Math.round(amount);
    const real = Math.min(v, tgt.maxHp - tgt.hp);
    tgt.hp += real;
    src.healDone += real;
    src.threat += real * 0.5 * src.def.stats.threat;
    if (v > 0) this.hud.number(tgt, v, 'heal');
  }

  addShield(u: Unit, v: number) { u.shield = Math.min(u.maxHp * 0.6, u.shield + v); }
  addDr(u: Unit, v: number, sec: number) { u.drs.push({ v, until: this.time + sec }); }
  taunt(e: Unit, by: Unit, sec: number) { e.tauntBy = by; e.tauntUntil = this.time + sec; e.target = by; }

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
    if (u.alive) ult.run(this, u, target);
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
