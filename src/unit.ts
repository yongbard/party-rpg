import { AnimationGroup, TransformNode, Vector3 } from '@babylonjs/core';
import type { ModelInstance } from './assets';
import type { UnitDef } from './data';
import { zeroBonus, type Bonus } from './items';

export type Side = 'hero' | 'enemy';

export class Unit {
  private static seq = 0;
  readonly id = ++Unit.seq;
  root: TransformNode;
  maxHp: number; hp: number;
  shield = 0; gauge = 0;
  cds: number[]; atkCd = 0; busyUntil = 0;
  alive = true;
  target: Unit | null = null; retargetAt = 0;
  threat: number; tauntBy: Unit | null = null; tauntUntil = 0;
  drs: { v: number; until: number }[] = [];
  moveTo: Vector3 | null = null;
  home: Vector3;
  yaw: number; yawGoal: number;
  scale: number; radius: number;
  dmgDone = 0; healDone = 0; dmgTaken = 0;
  curAnim: AnimationGroup | null = null;
  title?: string;            // 지금 등급의 칭호

  /** mul: 레벨에 따른 HP·공격·방어 배율 (data.ts 의 heroMul, enemyMul) */
  constructor(public def: UnitDef, public side: Side, public model: ModelInstance, pos: Vector3, yaw: number, public mul = 1, public bonus: Bonus = zeroBonus()) {
    this.root = model.root;
    this.scale = def.scale ?? 1;
    this.radius = 0.55 * this.scale;
    this.root.scaling.setAll(this.scale);
    this.root.position.copyFrom(pos);
    this.home = pos.clone();
    this.yaw = this.yawGoal = yaw;
    this.root.rotation.y = yaw;
    this.maxHp = this.hp = Math.round(def.stats.hp * mul + bonus.hp);
    this.cds = def.skills.map(s => s.cd * 0.5);
    this.threat = def.stats.threat * 150;
    model.anims.forEach(g => { g.enableBlending = true; g.blendingSpeed = 0.12; });
  }

  get pos() { return this.root.position; }
  get forward() { return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  chest() { return this.pos.add(new Vector3(0, 1.0 * this.scale, 0)); }
  head() { return this.pos.add(new Vector3(0, (this.def.model === 'q' ? 1.9 : 2.35) * this.scale, 0)); }
  muzzle() { return this.chest().add(this.forward.scale(0.5)).addInPlaceFromFloats(0, 0.2, 0); }

  animDur(name: string, speed = 1) {
    const g = this.model.anims.get(name);
    if (!g) return 0;
    const fps = g.targetedAnimations[0]?.animation.framePerSecond ?? 60;
    return (g.to - g.from) / fps / speed;
  }

  /** 애니메이션을 틀고 길이(초)를 돌려준다 */
  play(name: string, loop = true, speed = 1): number {
    const g = this.model.anims.get(name);
    if (!g) return 0;
    if (this.curAnim === g && loop && g.isPlaying) return this.animDur(name, speed);
    if (this.curAnim) this.curAnim.stop();
    g.start(loop, speed, g.from, g.to);
    this.curAnim = g;
    return this.animDur(name, speed);
  }

  face(p: Vector3) { this.yawGoal = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  faceNow(p: Vector3) { this.face(p); this.yaw = this.yawGoal; this.root.rotation.y = this.yaw; }

  turn(dt: number) {
    let d = this.yawGoal - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 12);
    this.root.rotation.y = this.yaw;
  }

  /** 받는 피해 감소 합 (최대 80%) */
  dr(t: number) {
    this.drs = this.drs.filter(d => d.until > t);
    return Math.min(0.8, this.drs.reduce((s, d) => s + d.v, 0));
  }

  atk() { return (this.def.stats.atk * this.mul + this.bonus.atk) * (1 + this.bonus.atkPct) * (1 + (this.def.rage ?? 0) * (1 - this.hp / this.maxHp)); }
  defense() { return this.def.stats.def * this.mul + this.bonus.def; }
  critRate() { return this.def.stats.crit + this.bonus.crit; }
  critDmg() { return this.def.stats.critDmg + this.bonus.critDmg; }
  spd() { return this.def.stats.spd + this.bonus.spd; }
}
