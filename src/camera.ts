import { ArcRotateCamera, Camera, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import type { Unit } from './unit';

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

const VIEWS = {
  battle: { alpha: -Math.PI / 2, beta: 0.84, radius: 23, target: new Vector3(0, 0, 5.2) },
  lobby: { alpha: -Math.PI / 2, beta: 1.36, radius: 12.5, target: new Vector3(0, 0.3, 3.2) },
};

export class CameraRig {
  main: ArcRotateCamera;
  cut: UniversalCamera;
  private base = VIEWS.battle;
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

  setView(v: keyof typeof VIEWS) {
    this.base = VIEWS[v];
    this.main.radius = this.base.radius;
    this.shakeAmp = 0;
    this.scene.activeCamera = this.main;
  }

  update(dt: number) {
    this.t += dt;
    this.anim?.(performance.now());
    const b = this.base;
    this.main.alpha = b.alpha + Math.sin(this.t * 0.23) * 0.035;
    this.main.beta = b.beta + Math.sin(this.t * 0.17) * 0.012;
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
    const head = u.pos.add(new Vector3(0, 1.75 * u.scale, 0));
    const f = u.forward;
    const r = new Vector3(f.z, 0, -f.x);
    this.cut.fov = 0.5;
    this.cut.position = head.add(f.scale(2.9)).add(r.scale(0.5)).addInPlaceFromFloats(0, -0.25, 0);
    this.cut.setTarget(head.add(new Vector3(0, -0.3, 0)));
    this.scene.activeCamera = this.cut;
  }

  usemain() { this.scene.activeCamera = this.main; }

  /** 필살기 컷인: 정면에서 천천히 다가간다. 실제 시간 ms 동안 */
  cutin(u: Unit, ms = 1300): Promise<void> {
    return new Promise(res => {
      const head = u.pos.add(new Vector3(0, 1.45 * u.scale, 0));
      const f = u.forward;
      const r = new Vector3(f.z, 0, -f.x);
      const from = head.add(f.scale(4.4)).add(r.scale(1.3)).addInPlaceFromFloats(0, 0.5, 0);
      const to = head.add(f.scale(2.6)).add(r.scale(0.7)).addInPlaceFromFloats(0, 0.1, 0);
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
