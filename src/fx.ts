// 이펙트: 파티클, 바닥 링, 빛기둥, 베기, 보호막, 투사체. 텍스처는 코드로 그린다.
import {
  Color3, Color4, Constants, DynamicTexture, GlowLayer, Matrix, Mesh, MeshBuilder,
  ParticleSystem, Scene, StandardMaterial, TrailMesh, Vector3,
} from '@babylonjs/core';
import { COL, type ProjKind } from './data';
import type { Unit } from './unit';

interface FxItem { update(dt: number): boolean }

function drawTex(scene: Scene, name: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const t = new DynamicTexture(name, size, scene, true);
  const g = t.getContext() as CanvasRenderingContext2D;
  g.clearRect(0, 0, size, size);
  draw(g, size);
  t.update();
  t.hasAlpha = true;
  return t;
}

export class Fx {
  glow: GlowLayer;
  flare: DynamicTexture;
  private ringTex: DynamicTexture;
  private discTex: DynamicTexture;
  private slashTex: DynamicTexture;
  private beamTex: DynamicTexture;
  private items: FxItem[] = [];
  private bursts: ParticleSystem[] = [];
  private burstIdx = 0;
  private heals: ParticleSystem[] = [];
  private healIdx = 0;
  private mats = new Map<string, StandardMaterial>();

  constructor(private scene: Scene) {
    this.glow = new GlowLayer('glow', scene, { mainTextureSamples: 2, blurKernelSize: 48 });
    this.glow.intensity = 0.65;

    this.flare = drawTex(scene, 'flare', 64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.25, 'rgba(255,255,255,.7)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    });
    this.ringTex = drawTex(scene, 'ring', 256, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,0)');
      r.addColorStop(0.72, 'rgba(255,255,255,0.05)');
      r.addColorStop(0.9, 'rgba(255,255,255,1)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    });
    this.discTex = drawTex(scene, 'disc', 256, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,.25)');
      r.addColorStop(0.9, 'rgba(255,255,255,.45)');
      r.addColorStop(0.95, 'rgba(255,255,255,1)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    });
    this.slashTex = drawTex(scene, 'slash', 256, (g, s) => {
      g.translate(s / 2, s / 2);
      for (let i = 0; i < 18; i++) {
        const k = i / 18;
        g.beginPath();
        g.arc(0, 0, s * (0.3 + k * 0.15), -Math.PI * 0.85, -Math.PI * 0.15);
        g.strokeStyle = `rgba(255,255,255,${(1 - Math.abs(k - 0.6) * 1.6) * 0.5})`;
        g.lineWidth = 3;
        g.stroke();
      }
    });
    this.beamTex = drawTex(scene, 'beam', 128, (g, s) => {
      const h = g.createLinearGradient(0, 0, s, 0);
      h.addColorStop(0, 'rgba(255,255,255,0)');
      h.addColorStop(0.5, 'rgba(255,255,255,1)');
      h.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = h; g.fillRect(0, 0, s, s);
      g.globalCompositeOperation = 'destination-in';
      const v = g.createLinearGradient(0, 0, 0, s);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(0.6, 'rgba(0,0,0,1)');
      v.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = v; g.fillRect(0, 0, s, s);
    });

    for (let i = 0; i < 10; i++) this.bursts.push(this.makeBurst());
    for (let i = 0; i < 6; i++) this.heals.push(this.makeHeal());
  }

  update(dt: number) { this.items = this.items.filter(i => i.update(dt)); }

  /** dur 초 동안 fn(0..1) 을 부른다 (전투 시간 기준) */
  tween(dur: number, fn: (k: number) => void, done?: () => void) {
    let t = 0;
    this.items.push({ update: dt => { t += dt; const k = Math.min(1, t / dur); fn(k); if (k >= 1) { done?.(); return false; } return true; } });
  }

  /** 빛나는 반투명 재질 (가산 혼합) */
  mat(color: Color3, tex: DynamicTexture | null, key = ''): StandardMaterial {
    const id = key && `${key}:${color.toHexString()}`;
    if (id && this.mats.has(id)) return this.mats.get(id)!;
    const m = new StandardMaterial('fxm', this.scene);
    m.disableLighting = true;
    m.emissiveColor = color;
    if (tex) { m.emissiveTexture = tex; m.opacityTexture = tex; }
    m.alphaMode = Constants.ALPHA_ADD;
    m.backFaceCulling = false;
    m.fogEnabled = false;
    m.disableDepthWrite = true;
    if (id) this.mats.set(id, m);
    return m;
  }

  private makeBurst() {
    const ps = new ParticleSystem('burst', 80, this.scene);
    ps.particleTexture = this.flare;
    ps.emitRate = 0;
    ps.minLifeTime = 0.2; ps.maxLifeTime = 0.5;
    ps.minSize = 0.06; ps.maxSize = 0.2;
    ps.minEmitPower = 2; ps.maxEmitPower = 5;
    ps.gravity = new Vector3(0, -7, 0);
    ps.createSphereEmitter(0.15);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.colorDead = new Color4(0, 0, 0, 0);
    ps.emitter = Vector3.Zero();
    ps.start();
    return ps;
  }

  private makeHeal() {
    const ps = new ParticleSystem('heal', 60, this.scene);
    ps.particleTexture = this.flare;
    ps.emitRate = 0;
    ps.minLifeTime = 0.6; ps.maxLifeTime = 1.1;
    ps.minSize = 0.08; ps.maxSize = 0.22;
    ps.minEmitPower = 0.3; ps.maxEmitPower = 0.8;
    ps.gravity = new Vector3(0, 2.2, 0);
    ps.createCylinderEmitter(0.6, 1.6, 0.2);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(0.5, 1, 0.6, 1);
    ps.color2 = new Color4(0.9, 1, 0.6, 1);
    ps.colorDead = new Color4(0, 0.3, 0, 0);
    ps.emitter = Vector3.Zero();
    ps.start();
    return ps;
  }

  burst(pos: Vector3, color: Color3, n = 14, power = 4, size = 0.18) {
    const ps = this.bursts[this.burstIdx++ % this.bursts.length];
    ps.emitter = pos.clone();
    ps.color1 = new Color4(color.r, color.g, color.b, 1);
    ps.color2 = new Color4(1, 1, 1, 1);
    ps.minEmitPower = power * 0.5; ps.maxEmitPower = power;
    ps.minSize = size * 0.35; ps.maxSize = size;
    ps.manualEmitCount = n;
  }

  heal(u: Unit) {
    const ps = this.heals[this.healIdx++ % this.heals.length];
    ps.emitter = u.pos.add(new Vector3(0, 0.6, 0));
    ps.manualEmitCount = 22;
    this.ring(u.pos, COL.green, 1.4, 0.5);
  }

  /** 바닥에서 퍼지는 링 */
  ring(pos: Vector3, color: Color3, radius: number, dur = 0.5) {
    const m = MeshBuilder.CreatePlane('ring', { size: 2 }, this.scene);
    m.rotation.x = Math.PI / 2;
    m.position.set(pos.x, 0.08, pos.z);
    const mat = this.mat(color, this.ringTex);
    m.material = mat;
    m.isPickable = false;
    this.glow.addExcludedMesh(m);
    this.tween(dur, k => {
      const e = 1 - Math.pow(1 - k, 3);
      m.scaling.setAll(0.2 + e * radius);
      mat.alpha = 1 - k;
    }, () => { m.dispose(); mat.dispose(); });
  }

  /** 보스 광역기 예고: 안쪽이 차오르는 붉은 원 */
  telegraph(pos: Vector3, radius: number, dur: number) {
    const outer = MeshBuilder.CreatePlane('tg', { size: radius * 2 }, this.scene);
    outer.rotation.x = Math.PI / 2;
    outer.position.set(pos.x, 0.07, pos.z);
    const om = this.mat(COL.red, this.discTex);
    outer.material = om;
    const inner = outer.clone('tgi');
    inner.position.y = 0.075;
    const im = this.mat(new Color3(1, 0.35, 0.15), this.discTex);
    inner.material = im;
    this.glow.addExcludedMesh(outer);
    this.glow.addExcludedMesh(inner);
    this.tween(dur, k => {
      inner.scaling.setAll(Math.max(0.01, k));
      om.alpha = 0.6 + Math.sin(k * 40) * 0.25;
    }, () => { outer.dispose(); inner.dispose(); om.dispose(); im.dispose(); });
  }

  /** 맞은 자리의 베기 자국 (화면을 바라본다) */
  slash(pos: Vector3, color: Color3) {
    const m = MeshBuilder.CreatePlane('slash', { size: 1.6 }, this.scene);
    m.billboardMode = Mesh.BILLBOARDMODE_ALL;
    m.position.copyFrom(pos);
    m.rotation.z = Math.random() * Math.PI * 2;
    const mat = this.mat(color, this.slashTex);
    m.material = mat;
    this.glow.addExcludedMesh(m);
    this.tween(0.22, k => { m.scaling.setAll(0.7 + k * 0.6); mat.alpha = 1 - k * k; }, () => { m.dispose(); mat.dispose(); });
  }

  /** 하늘에서 내리꽂는 빛기둥 */
  pillar(pos: Vector3, color: Color3, dur = 0.8) {
    const m = MeshBuilder.CreateCylinder('pillar', { height: 9, diameter: 1.1, cap: Mesh.NO_CAP, tessellation: 20 }, this.scene);
    m.position.set(pos.x, 4.5, pos.z);
    const mat = this.mat(color, this.beamTex);
    m.material = mat;
    this.glow.addExcludedMesh(m);
    this.ring(pos, color, 2.2, 0.5);
    this.burst(pos.add(new Vector3(0, 0.5, 0)), color, 20, 5, 0.25);
    this.tween(dur, k => { m.scaling.x = m.scaling.z = 1.4 - k * 1.2; mat.alpha = 1 - k; }, () => { m.dispose(); mat.dispose(); });
  }

  /** 유닛을 감싸는 보호막 */
  bubble(u: Unit, color: Color3, dur: number) {
    const m = MeshBuilder.CreateSphere('bubble', { diameter: 2.3, segments: 24 }, this.scene);
    m.parent = u.root;
    m.position.y = 1.05;
    const mat = new StandardMaterial('bm', this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = color;
    mat.alpha = 0.18;
    mat.alphaMode = Constants.ALPHA_ADD;
    mat.fogEnabled = false;
    mat.disableDepthWrite = true;
    m.material = mat;
    m.isPickable = false;
    this.glow.addExcludedMesh(m);
    this.tween(dur, k => {
      const pulse = 0.12 + Math.sin(k * dur * 6) * 0.04;
      mat.alpha = k > 0.85 ? pulse * (1 - (k - 0.85) / 0.15) : (k < 0.06 ? pulse * 3 : pulse);
      if (!u.alive) mat.alpha = 0;
    }, () => { m.dispose(); mat.dispose(); });
  }

  projectile(kind: ProjKind, scale = 1): { mesh: Mesh; trail: TrailMesh } {
    const color = { bolt: COL.bone, gold: COL.gold, magic: COL.blue, dark: COL.purple, bone: COL.bone }[kind];
    let mesh: Mesh;
    if (kind === 'magic' || kind === 'dark') {
      mesh = MeshBuilder.CreateSphere('proj', { diameter: 0.28, segments: 10 }, this.scene);
      mesh.material = this.mat(color.scale(1.6), null, 'projOrb');
    } else {
      mesh = MeshBuilder.CreateCylinder('proj', { height: 0.75, diameter: 0.05, tessellation: 6 }, this.scene);
      mesh.bakeTransformIntoVertices(Matrix.RotationX(Math.PI / 2));
      mesh.material = this.mat(color, null, 'projBolt');
    }
    mesh.scaling.setAll(scale);
    mesh.isPickable = false;
    const trail = new TrailMesh('trail', mesh, this.scene, (kind === 'magic' || kind === 'dark' ? 0.2 : 0.07) * scale, 14, true);
    const tm = this.mat(color, null, 'trail');
    tm.alpha = 0.55;
    trail.material = tm;
    return { mesh, trail };
  }

  /** 횃불 불꽃 (계속 탄다) */
  fire(pos: Vector3, scale = 1) {
    const ps = new ParticleSystem('fire', 90, this.scene);
    ps.particleTexture = this.flare;
    ps.emitter = pos.clone();
    ps.createSphereEmitter(0.07 * scale);
    ps.emitRate = 50;
    ps.minLifeTime = 0.25; ps.maxLifeTime = 0.55;
    ps.minSize = 0.12 * scale; ps.maxSize = 0.32 * scale;
    ps.minEmitPower = 0.1; ps.maxEmitPower = 0.4;
    ps.gravity = new Vector3(0, 2.4, 0);
    ps.color1 = new Color4(1, 0.72, 0.28, 1);
    ps.color2 = new Color4(1, 0.38, 0.08, 1);
    ps.colorDead = new Color4(0.25, 0.04, 0, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.start();
    const halo = MeshBuilder.CreatePlane('halo', { size: 1.6 * scale }, this.scene);
    halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
    halo.position.copyFrom(pos).addInPlaceFromFloats(0, 0.1, 0);
    const hm = this.mat(new Color3(1, 0.45, 0.15), this.flare, 'halo');
    hm.alpha = 0.5;
    halo.material = hm;
    this.glow.addExcludedMesh(halo);
    return ps;
  }

  /** 공중에 떠도는 불티 */
  embers() {
    const ps = new ParticleSystem('embers', 260, this.scene);
    ps.particleTexture = this.flare;
    ps.emitter = new Vector3(0, 0, 3);
    ps.minEmitBox = new Vector3(-9, 0, -12);
    ps.maxEmitBox = new Vector3(9, 2, 17);
    ps.emitRate = 22;
    ps.minLifeTime = 4; ps.maxLifeTime = 8;
    ps.minSize = 0.025; ps.maxSize = 0.07;
    ps.direction1 = new Vector3(-0.3, 0.6, -0.3);
    ps.direction2 = new Vector3(0.3, 1, 0.3);
    ps.minEmitPower = 0.15; ps.maxEmitPower = 0.45;
    ps.gravity = new Vector3(0, 0.12, 0);
    ps.color1 = new Color4(1, 0.55, 0.2, 1);
    ps.color2 = new Color4(1, 0.8, 0.4, 0.8);
    ps.colorDead = new Color4(0.4, 0.1, 0, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.preWarmCycles = 200;
    ps.start();
  }
}
