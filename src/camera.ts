import { ArcRotateCamera, Camera, Matrix, Scene, TransformNode, UniversalCamera, Vector3 } from '@babylonjs/core';
import type { Unit } from './unit';

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export interface View { alpha: number; beta: number; radius: number; target: Vector3 }
const copy = (v: View): View => ({ ...v, target: v.target.clone() });

const VIEWS: Record<string, View> = {
  battle: { alpha: -Math.PI / 2, beta: 0.84, radius: 23, target: new Vector3(0, 0, 5.2) },
  lobby: { alpha: -Math.PI / 2, beta: 1.36, radius: 12.5, target: new Vector3(0, 0.3, 3.2) },
};

const LINEUP_MID = new Vector3(0, 0.9, 3.4);   // 로비 파티 가운데 (lobby.ts LINEUP)

export class CameraRig {
  main: ArcRotateCamera;
  cut: UniversalCamera;
  private base: View = VIEWS.battle;
  private cur: View = copy(VIEWS.battle);   // base 를 부드럽게 따라간다
  private shakeAmp = 0;
  private t = 0;
  private anim: ((now: number) => void) | null = null;
  // 로비: 패널에 가리지 않는 화면 세로 구간(0 위 ~ 1 아래)과 그 가운데에 둘 점. 렌즈만 위아래로 민다 (카메라 자리·각도는 그대로)
  private band: [number, number] = [0, 1];
  private subject: Vector3 | null = null;
  private shift = 0;

  constructor(private scene: Scene) {
    const b = this.base;
    this.main = new ArcRotateCamera('main', b.alpha, b.beta, b.radius, b.target.clone(), scene);
    this.main.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED;
    this.main.fov = 0.56;
    this.main.minZ = 0.3;
    this.main.maxZ = 150;
    this.cut = new UniversalCamera('cut', Vector3.Zero(), scene);
    this.cut.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED;
    this.cut.fov = 0.9;
    this.cut.minZ = 0.05;
    this.cut.maxZ = 150;
    scene.activeCamera = this.main;
  }

  shake(a: number) { this.shakeAmp = Math.max(this.shakeAmp, a); }

  /** 'battle' · 'lobby' 또는 직접 만든 시점. instant 면 바로 옮기고, 아니면 부드럽게 따라간다 */
  setView(v: 'battle' | 'lobby' | View, instant = false) {
    this.base = typeof v === 'string' ? VIEWS[v] : v;
    this.subject = v === 'lobby' ? LINEUP_MID : null;
    if (instant) { this.cur = copy(this.base); this.shift = this.goalShift(); }
    this.shakeAmp = 0;
    this.scene.activeCamera = this.main;
  }

  /** 전투: 살아 있는 유닛이 모두 들어오게 가까이 다가간다 (멀리서 보면 캐릭터가 작다) */
  frame(units: Unit[]) {
    if (!units.length) return;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const u of units) { x0 = Math.min(x0, u.pos.x); x1 = Math.max(x1, u.pos.x); z0 = Math.min(z0, u.pos.z); z1 = Math.max(z1, u.pos.z); }
    // 가로 화각 0.56 → 거리 d 에서 보이는 폭은 약 0.575d. 세로(깊이)는 기울어 보이므로 덜 잡는다
    const radius = Math.min(21, Math.max(13, (x1 - x0 + 4) / 0.575, (z1 - z0 + 5) * 0.95));
    this.base = { alpha: -Math.PI / 2, beta: 0.86, radius, target: new Vector3((x0 + x1) * 0.25, 0, (z0 + z1) / 2 + 0.6) };
  }

  /** 로비에 선 유닛을 가까이서 본다. 빈 구간이 넓으면 다가가서 키가 구간의 6할쯤 되게 */
  focus(u: Unit) {
    const mid = u.pos.add(new Vector3(0, 0.95 * u.scale * u.tall, 0));
    const tanV = 1 / this.main.getProjectionMatrix(true).m[5];
    const radius = Math.min(9.5, Math.max(4.8, (2 * u.scale * u.tall) / (0.6 * 2 * (this.band[1] - this.band[0]) * tanV)));
    this.setView({ alpha: -Math.PI / 2, beta: 1.36, radius, target: mid });
    this.subject = mid;
  }

  /** 로비 패널이 바뀔 때: 가리지 않는 세로 구간 (화면 높이 비율) */
  setBand(top: number, bottom: number) { this.band = [top, Math.max(top + 0.12, bottom)]; }

  /** subject 가 band 가운데에 오게 하는 렌즈 밀기 (화면 좌표 -1~1 단위) */
  private goalShift() {
    if (!this.subject) return 0;
    const c = this.cur;
    const eye = c.target.add(new Vector3(Math.cos(c.alpha) * Math.sin(c.beta), Math.cos(c.beta), Math.sin(c.alpha) * Math.sin(c.beta)).scale(c.radius));
    const view = Matrix.LookAtRH(eye, c.target, Vector3.Up());
    const v = Vector3.TransformCoordinates(this.subject, view);
    const ndc = 1 - (this.band[0] + this.band[1]);
    return ndc - (v.y * this.main.getProjectionMatrix().m[5]) / Math.abs(v.z);
  }

  /** 투영 행렬을 세로로 민다 (off-axis). 카메라를 옮기면 낮은 시점에서 바닥 밑이 보인다 */
  private lens(s: number) {
    const cam = this.main;
    cam.unfreezeProjectionMatrix();
    if (Math.abs(s) < 1e-4) return;
    const p = cam.getProjectionMatrix(true).clone();
    p.addAtIndex(9, s * p.m[11]);
    cam.freezeProjectionMatrix(p);
  }

  update(dt: number) {
    this.t += dt;
    this.anim?.(performance.now());
    const k = 1 - Math.exp(-dt * 5);
    const c = this.cur, b0 = this.base;
    c.alpha += (b0.alpha - c.alpha) * k;
    c.beta += (b0.beta - c.beta) * k;
    c.radius += (b0.radius - c.radius) * k;
    c.target = Vector3.Lerp(c.target, b0.target, k);
    const b = c;
    this.main.alpha = b.alpha + Math.sin(this.t * 0.23) * 0.035;
    this.main.beta = b.beta + Math.sin(this.t * 0.17) * 0.012;
    this.main.radius = b.radius;
    const a = this.shakeAmp;
    this.main.target.set(
      b.target.x + (Math.random() - 0.5) * a,
      b.target.y + (Math.random() - 0.5) * a,
      b.target.z + (Math.random() - 0.5) * a * 0.5,
    );
    this.shift += (this.goalShift() - this.shift) * k;
    this.lens(this.shift);
    this.shakeAmp *= Math.exp(-dt * 9);
    if (this.shakeAmp < 0.002) this.shakeAmp = 0;
  }

  /** 얼굴 정면 초상화 구도 */
  portrait(u: Unit) {
    // 사람보다 큰 몸(용)은 얼굴이 몸통보다 앞에 있어 머리 뼈를 직접 겨눈다
    const hb = u.tall !== 1 ? (u.model.find('Head') as TransformNode | undefined) : undefined;
    const head = hb ? hb.computeWorldMatrix(true).getTranslation().addInPlaceFromFloats(0, 0.15 * u.scale, 0)
      : u.pos.add(new Vector3(0, (u.def.model === 'q' ? 1.6 : 1.75) * u.scale, 0));
    const f = u.forward;
    const r = new Vector3(f.z, 0, -f.x);
    this.cut.fov = 0.5;
    this.cut.position = head.add(f.scale(u.def.model === 'q' ? 2.0 * u.tall : 2.9)).add(r.scale(0.35)).addInPlaceFromFloats(0, -0.1, 0);
    this.cut.setTarget(head.add(new Vector3(0, -0.2, 0)));
    this.scene.activeCamera = this.cut;
  }

  usemain() { this.scene.activeCamera = this.main; }

  /** 필살기 컷인: 정면에서 천천히 다가간다. 실제 시간 ms 동안 */
  cutin(u: Unit, ms = 1300): Promise<void> {
    return new Promise(res => {
      const head = u.pos.add(new Vector3(0, 1.45 * u.scale * u.tall, 0));
      const f = u.forward;
      const r = new Vector3(f.z, 0, -f.x);
      const from = head.add(f.scale(4.4 * u.tall)).add(r.scale(1.3)).addInPlaceFromFloats(0, 0.5, 0);
      const to = head.add(f.scale(2.6 * u.tall)).add(r.scale(0.7)).addInPlaceFromFloats(0, 0.1, 0);
      const look = head.add(new Vector3(0, -0.35, 0));
      this.cut.fov = 0.95;
      this.scene.activeCamera = this.cut;
      const t0 = performance.now();
      this.anim = now => {
        const k = Math.min(1, (now - t0) / ms);
        const e = ease(Math.min(1, k / 0.45));
        this.cut.position = Vector3.Lerp(from, to, e).add(r.scale(k * 0.25));
        this.cut.setTarget(look);
        if (k >= 1) {
          this.anim = null;
          this.scene.activeCamera = this.main;
          res();
        }
      };
    });
  }
}
