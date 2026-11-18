import { AnimationGroup, TransformNode, Vector3 } from '@babylonjs/core';
import type { ModelInstance } from './assets';
import type { UnitDef } from './data';
import { zeroBonus, type Bonus } from './items';
import { policyThreat, type Policy } from './tactics';

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
  buffAtk = 0; buffSpd = 0;   // 잠깐 걸리는 공격력 배율(+0.2 = 20%)·공격 속도 (battle.buff)
  unbrokenUsed = false;      // 특성 불굴은 한 번만
  firstCrit = false;         // 특성 기습: 첫 공격 치명
  ultMul = 1;                // 필살기 단계 배율 (talents.ts ULT_MUL)
  ultUntil = 0;              // 이 시각까지 주는 피해·치유가 필살기 것 (ultMul 적용)
  // 장비 고유 효과 상태 (uniques.ts)
  undyingUsed = false;       // 불사의 갑옷은 한 번만
  shadeUntil = 0;            // 그림자 망토: 이 시각까지 적이 노리지 않는다
  shadeHit = false;          // 그림자 망토: 다음 공격 피해 증가
  critUntil = 0;             // 집중의 투구 2차: 이 시각까지 모든 공격 치명
  regenAt = 3;               // 재생의 갑옷: 다음 회복 시각
  atkCount = 0;              // 광풍 4세트: 기본 공격 수
  // 전투 깊이 (tactics.ts)
  policy: Policy = 'attack'; // 행동 방침
  slot = 0;                  // 진형 자리: 0·1 앞줄, 2·3 뒷줄
  holdUntil = 0;             // 이 시각까지 holdTo 로 걸어간다 (앞뒤 교대, 생존 우선 후퇴)
  holdTo: Vector3 | null = null;
  retreatAt = 0;             // 생존 우선: 다음에 물러날 수 있는 시각
  moveTo: Vector3 | null = null;
  home: Vector3;
  yaw: number; yawGoal: number;
  scale: number; radius: number;
  tall: number;              // 몸 키 배율 (용 등 사람보다 큰 몸)
  dmgDone = 0; healDone = 0; dmgTaken = 0;
  curAnim: AnimationGroup | null = null;
  title?: string;            // 지금 등급의 칭호

  /** mul: 레벨에 따른 HP·공격·방어 배율 (data.ts 의 heroMul, enemyMul) */
  constructor(public def: UnitDef, public side: Side, public model: ModelInstance, pos: Vector3, yaw: number, public mul = 1, public bonus: Bonus = zeroBonus()) {
    this.root = model.root;
    this.scale = def.scale ?? 1;
    this.tall = model.tall ?? 1;
    this.radius = 0.55 * this.scale;
    this.root.scaling.setAll(this.scale);
    this.root.position.copyFrom(pos);
    this.home = pos.clone();
    this.yaw = this.yawGoal = yaw;
    this.root.rotation.y = yaw;
    this.maxHp = this.hp = Math.round((def.stats.hp * mul + bonus.hp) * (1 + bonus.hpPct));
    this.cds = def.skills.map(s => s.cd * 0.5);
    this.threat = this.has('stealth') ? 0 : this.threatMul() * 150;
    this.firstCrit = this.has('stealth');
    model.anims.forEach(g => { g.enableBlending = true; g.blendingSpeed = 0.12; });
  }

  get pos() { return this.root.position; }
  get forward() { return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  chest() { return this.pos.add(new Vector3(0, 1.0 * this.scale, 0)); }
  head() { return this.pos.add(new Vector3(0, (this.def.model === 'q' ? 1.9 * this.tall : 2.1) * this.scale, 0)); }
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
    return Math.min(0.8, this.bonus.drPct + 0.2 * this.uq('guardian') + this.drs.reduce((s, d) => s + d.v, 0));
  }

  /** 배운 끝 노드 (talents.ts) */
  has(cap: string) { return this.bonus.caps.includes(cap); }
  /** 장비 고유 효과의 세기 (없으면 0) */
  uq(id: string) { return this.bonus.uniq[id] ?? 0; }
  /** 고유 효과의 2차 효과가 켜졌나 (신화 이상) */
  uq2(id: string) { return this.bonus.uniq2.includes(id); }
  threatMul() { return this.def.stats.threat * Math.max(0.1, 1 + this.bonus.threatPct) * (this.uq('guardian') ? 2 : 1) * policyThreat(this.policy); }

  atk() { return (this.def.stats.atk * this.mul + this.bonus.atk) * (1 + this.bonus.atkPct + this.buffAtk) * (1 + ((this.def.rage ?? 0) + this.bonus.rage) * (1 - this.hp / this.maxHp)) * (this.uq('guardian') ? 0.85 : 1); }
  defense() { return (this.def.stats.def * this.mul + this.bonus.def) * (1 + this.bonus.defPct); }
  critRate() { return this.def.stats.crit + this.bonus.crit; }
  critDmg() { return this.def.stats.critDmg + this.bonus.critDmg + (this.uq2('keen') ? 0.3 : 0); }
  spd() { return this.def.stats.spd + this.bonus.spd + this.buffSpd + 15 * this.uq('gale'); }
}
