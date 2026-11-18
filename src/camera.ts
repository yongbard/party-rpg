import { ArcRotateCamera, Camera, Scene, TransformNode, UniversalCamera, Vector3 } from '@babylonjs/core';
import type { Unit } from './unit';

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export interface View { alpha: number; beta: number; radius: number; target: Vector3 }
const copy = (v: View): View => ({ ...v, target: v.target.clone() });

const VIEWS: Record<string, View> = {
  battle: { alpha: -Math.PI / 2, beta: 0.84, radius: 23, target: new Vector3(0, 0, 5.2) },
  lobby: { alpha: -Math.PI / 2, beta: 1.36, radius: 12.5, target: new Vector3(0, 0.3, 3.2) },
};

export class CameraRig {
  main: ArcRotateCamera;
  cut: UniversalCamera;
  private base: View = VIEWS.battle;
  private cur: View = copy(VIEWS.battle);   // base 를 부드럽게 따라간다
  private shakeAmp = 0;
  private t = 0;
  private anim: ((now: number) => void) | null = null;

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
    if (instant) this.cur = copy(this.base);
    this.shakeAmp = 0;
    this.scene.activeCamera = this.main;
  }

  /** 로비에 선 유닛을 가까이서 본다 (아래쪽 패널을 피해 화면 위쪽에 오게) */
  focus(u: Unit) {
    // 카메라는 바닥 위(약 1.3)에서 살짝 내려다본다. 시선 끝을 바닥 아래에 둬서 영웅이 화면 위쪽(패널 위)에 오게 한다
    this.setView({ alpha: -Math.PI / 2, beta: 1.25, radius: 9.5, target: new Vector3(u.pos.x, -1.6, u.pos.z) });
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
