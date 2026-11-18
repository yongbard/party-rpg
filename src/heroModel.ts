// 조합형 영웅 모델: 몸(얼굴) + 의상 파츠 + 헤어를 한 스켈레톤에 붙이고, 무기·이펙트를 얹고, 공용 애니메이션(UAL)을 연결한다
import {
  AbstractMesh, AnimationGroup, Color3, Color4, DynamicTexture, Engine, Mesh, MeshBuilder, Node, ParticleSystem, PBRMaterial, Scene, ShadowGenerator,
  StandardMaterial, TransformNode, Vector3,
} from '@babylonjs/core';
import type { Assets, ModelInstance } from './assets';
import type { Look } from './data';
import type { Fx } from './fx';

export const ANIM_KEYS = ['q/anim/UAL1', 'q/anim/UAL2'];
export const lookKeys = (l: Look) => [l.body, ...(l.parts ?? []), ...(l.hair ?? []), l.weapon, l.offhand, l.helmet, l.cloak, ...(l.acc ?? []).filter(k => !k.startsWith('fx:'))].filter((k): k is string => !!k);

// 무기를 손 뼈에 붙이는 각도·위치 (hand_r / hand_l 좌표계). 팩마다 무기 축이 달라 종류별로 맞춘다
type Grip = { rot: [number, number, number]; pos: [number, number, number]; scale?: number };
const D = Math.PI / 180;
const GRIPS: Record<string, Grip> = {
  // 손 뼈는 손가락 쪽이 +Y. 손잡이는 손가락과 직각인 +X 방향으로 눕힌다 (poc.html 로 각도 확인)
  blade: { rot: [0, 0, -90 * D], pos: [0, 0.08, 0] },            // Binbun 검·도끼·망치 (+Y 방향, 손잡이가 원점)
  kkBlade: { rot: [0, 0, -90 * D], pos: [0, 0.08, 0] },
  staff: { rot: [0, 0, -90 * D], pos: [0, 0.08, 0] },            // KayKit 지팡이 (가운데가 원점)
  bow: { rot: [90 * D, 90 * D, 0], pos: [0, 0.08, 0] },          // KayKit 활 (X 방향으로 누움) → 세로, 시위가 몸 쪽
  shield: { rot: [-90 * D, 0, 90 * D], pos: [0, 0.05, -0.08] },  // 왼손, 판이 앞을 본다
  // KayKit 모자·망토: 원래 치비 캐릭터의 head / chest 뼈 기준 위치로 들어 있다. 사람 머리는 훨씬 작다
  head: { rot: [0, 0, 0], pos: [0, -0.075, 0.01], scale: 0.32 },
  back: { rot: [0, 0, 0], pos: [0, -0.25, 0], scale: 0.7 },
};
function gripOf(key: string): Grip {
  const n = key.split('/').pop()!;
  if (/shield/.test(n)) return GRIPS.shield;
  if (/bow/.test(n)) return GRIPS.bow;
  if (/staff|wand/.test(n)) return GRIPS.staff;
  if (n.startsWith('kk_')) return GRIPS.kkBlade;
  return GRIPS.blade;
}
export function setGrip(name: string, g: Grip) { GRIPS[name] = g; }   // 맞춤 확인용 (poc)

// 장식(4겹): 뼈에 고정한다. 소품은 가장 긴 변을 size(m) 로 맞추고 가운데를 원점에 둔다. pos·rot 는 그 뼈 좌표계 (poc.html ?acc= 로 맞춤)
type AccFit = { bone: string; size: number; pos: [number, number, number]; rot: [number, number, number] };
const ACC_FIT: Record<string, AccFit> = {
  Crown: { bone: 'Head', size: 0.2, pos: [0, 0.2, 0.01], rot: [0, 0, 0] },
  Armor_Metal: { bone: 'spine_03', size: 0.55, pos: [0, 0.08, 0.02], rot: [0, 0, 0] },
  Armor_Golden: { bone: 'spine_03', size: 0.6, pos: [0, 0.08, 0.02], rot: [0, 0, 0] },
  Armor_Leather: { bone: 'spine_03', size: 0.5, pos: [0, 0.05, 0.02], rot: [0, 0, 0] },
  Necklace1: { bone: 'spine_03', size: 0.2, pos: [0, 0.17, 0.11], rot: [0, 0, 0] },
  Necklace3: { bone: 'spine_03', size: 0.2, pos: [0, 0.17, 0.11], rot: [0, 0, 0] },
  Quiver: { bone: 'spine_03', size: 0.6, pos: [0.05, 0.02, -0.16], rot: [70 * D, 0, 20 * D] },   // 화살이 위로, 오른 어깨 쪽으로 기운다
  Backpack: { bone: 'spine_03', size: 0.45, pos: [0, 0, -0.2], rot: [0, 0, 0] },
  Bag: { bone: 'pelvis', size: 0.25, pos: [0.15, 0, 0.05], rot: [0, 0, 0] },
  Skull: { bone: 'spine_03', size: 0.12, pos: [-0.17, 0.17, 0.02], rot: [0, 0, 0] },   // 왼 어깨 위 전리품
  halo: { bone: 'Head', size: 0.34, pos: [0, 0.32, -0.04], rot: [0, 0, 0] },
  wings: { bone: 'spine_03', size: 0.9, pos: [0, 0.05, -0.15], rot: [0, 0, 0] },
  horns: { bone: 'Head', size: 0.22, pos: [0, 0.14, 0.02], rot: [0, 0, 0] },
  orbs: { bone: '', size: 0.45, pos: [0, 1.15, 0], rot: [0, 0, 0] },   // 뼈 없이 몸 둘레를 돈다
};
export function setAccFit(name: string, f: AccFit) { ACC_FIT[name] = f; }   // 맞춤 확인용 (poc)

/** 빛 날개 그림 (깃털 5장, 가운데가 밝다). 장면마다 하나 */
const wingTex = new WeakMap<Scene, DynamicTexture>();
function wingTexture(scene: Scene) {
  let t = wingTex.get(scene);
  if (t) return t;
  t = new DynamicTexture('wing', { width: 256, height: 256 }, scene, true);
  const c = t.getContext() as CanvasRenderingContext2D;
  c.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 5; i++) {
    const a = -0.15 - i * 0.28, len = 230 - i * 22;
    c.save();
    c.translate(10, 200);
    c.rotate(a);
    const g = c.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(len / 2, 0, len / 2, 16 - i, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  t.hasAlpha = true;
  t.update();
  wingTex.set(scene, t);
  return t;
}

/** 코드로 만드는 빛 장식. 만든 메시와 매 프레임 움직임을 돌려준다 */
function makeFxAcc(kind: string, scene: Scene, color: Color3, size: number): { meshes: Mesh[]; tick?: (t: number) => void } {
  const glowMat = (name: string) => {
    const m = new StandardMaterial(name, scene);
    m.emissiveColor = color;
    m.diffuseColor = Color3.Black();
    m.disableLighting = true;
    return m;
  };
  if (kind === 'halo') {
    const m = MeshBuilder.CreateTorus('halo', { diameter: size, thickness: size * 0.08, tessellation: 40 }, scene);
    m.material = glowMat('halo');
    return { meshes: [m], tick: t => (m.position.y = Math.sin(t * 2) * 0.012) };
  }
  if (kind === 'wings') {
    const mat = glowMat('wings');
    mat.emissiveTexture = wingTexture(scene);
    mat.opacityTexture = mat.emissiveTexture;
    mat.alphaMode = Engine.ALPHA_ADD;
    mat.backFaceCulling = false;
    const ws = [1, -1].map(side => {
      const p = MeshBuilder.CreatePlane('wing', { size }, scene);
      p.material = mat;
      p.scaling.x = side;                       // 왼쪽은 뒤집는다
      p.position.x = side * size * 0.42;
      p.position.y = size * 0.25;
      return p;
    });
    return { meshes: ws, tick: t => ws.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.5 + Math.sin(t * 2.2) * 0.18))) };
  }
  if (kind === 'horns') {
    const mat = new PBRMaterial('horn', scene);
    mat.albedoColor = new Color3(0.12, 0.08, 0.07);
    mat.roughness = 0.5;
    mat.emissiveColor = color.scale(0.25);
    const hs = [1, -1].map(side => {
      const path = Array.from({ length: 9 }, (_, i) => { const k = i / 8; return new Vector3(side * (0.05 + k * 0.08 + k * k * 0.04), k * size * 0.8, -k * k * size * 0.5); });
      const m = MeshBuilder.CreateTube('horn', { path, radiusFunction: i => 0.032 * (1 - i / 9) + 0.003, tessellation: 10, cap: Mesh.CAP_START }, scene);
      m.material = mat;
      return m;
    });
    return { meshes: hs };
  }
  // orbs: 몸 둘레를 도는 빛 구슬 3개
  const mat = glowMat('orb');
  const os = [0, 1, 2].map(() => { const m = MeshBuilder.CreateSphere('orb', { diameter: 0.09, segments: 8 }, scene); m.material = mat; return m; });
  return {
    meshes: os,
    tick: t => os.forEach((o, i) => {
      const a = t * 1.4 + (i * Math.PI * 2) / 3;
      o.position.set(Math.cos(a) * size, Math.sin(t * 2 + i) * 0.12, Math.sin(a) * size);
    }),
  };
}
// 머리가 큰 체형은 투구를 따로 맞춘다 (poc.html?hero=pug&grip=head:... 로 확인)
const HEAD_FIT: Record<string, Grip> = {
  'q/body/Puglin': { rot: [0, 0, 0], pos: [0, -0.04, 0.03], scale: 0.55 },
};
// 사람과 비율이 다른 몸 (AI 모델에 뼈대를 옮겨 심은 것, src/tools/blender_rig.py). UAL 의 뼈 위치 키를 빼고 회전만 쓴다
const POSE_ONLY = /^q\/body\/Tripo/;
// 사람(키 약 1.8)보다 큰 몸: 머리 위 HP 바·초상화·컷인 높이에 곱한다
const BODY_TALL: Record<string, number> = { 'q/body/TripoDragon': 1.3 };
// 몸 파일에 붙어 나오는 무기 (Bestiary). 무기는 look 이 정하므로 숨긴다
const BUILTIN_WEAPON = /^(Puglin_Stick|Imp_Mace)$/;

const tintMat = (m: AbstractMesh, c: [number, number, number]) => {
  const mat = m.material;
  if (mat instanceof PBRMaterial) mat.albedoColor = new Color3(...c);
};

/** look 의 키들은 assets.ensure 로 미리 받아 둬야 한다 */
export function makeHeroModel(assets: Assets, scene: Scene, look: Look, shadow: ShadowGenerator | null, fx: Fx | null): ModelInstance {
  const holder = new TransformNode('hero', scene);
  const owned: { dispose(): void }[] = [];

  // 1. 몸: 스켈레톤과 뼈 노드의 주인
  const body = assets.container(look.body).instantiateModelsToScene(n => n, !!look.skin, { doNotInstantiate: true });
  owned.push(body);
  body.rootNodes.forEach(r => (r.parent = holder));
  const skel = body.skeletons[0];
  const bodyRoot = body.rootNodes[0] as TransformNode;
  const meshes: AbstractMesh[] = holder.getChildMeshes(false).filter(m => {
    if (!BUILTIN_WEAPON.test(m.name)) return true;
    m.setEnabled(false);
    return false;
  });
  if (look.skin) meshes.forEach(m => tintMat(m, look.skin!));

  // 2. 의상 파츠·헤어: 자기 스켈레톤을 버리고 몸 스켈레톤으로 움직인다 (같은 65관절 이름)
  // 투구를 쓰면 머리카락은 눈썹만 남긴다 (뚫고 나오지 않게)
  const hair = look.helmet ? (look.hair ?? []).filter(h => /Eyebrows/.test(h)) : (look.hair ?? []);
  for (const key of [...(look.parts ?? []), ...hair]) {
    const isPart = key.startsWith('q/part/');
    const e = assets.container(key).instantiateModelsToScene(n => n, isPart && !!look.tint, { doNotInstantiate: true });
    const ms = e.rootNodes.flatMap(r => (r as TransformNode).getChildMeshes(false)).filter(m => m.getTotalVertices() > 0);
    for (const m of ms) {
      m.parent = bodyRoot;
      m.skeleton = skel;
      if (isPart && look.tint) tintMat(m, look.tint);
      meshes.push(m);
    }
    e.skeletons.forEach(sk => sk.dispose());
    e.rootNodes.forEach(r => r.dispose(true));     // 메시는 옮겼으므로 남은 노드만 지워진다
  }

  // 3. 무기·보조: 손 뼈 노드에 붙인다
  const boneNode = (name: string) => skel.bones.find(b => b.name === name)?.getTransformNode() ?? null;
  const attach = (key: string | undefined, hand: string, grip?: Grip) => {
    if (!key) return;
    const e = assets.container(key).instantiateModelsToScene(n => n, !!look.glow, { doNotInstantiate: true });
    owned.push(e);
    const g = grip ?? gripOf(key);
    const pivot = new TransformNode(`grip_${hand}`, scene);
    pivot.parent = boneNode(hand) ?? bodyRoot;
    pivot.position.set(...g.pos);
    pivot.rotation.set(...g.rot);
    // KayKit 무기는 머리 큰 캐릭터용이라 사람 손에는 크다
    pivot.scaling.setAll((g.scale ?? 1) * (key.includes('/kk_') ? 0.6 : 1));
    owned.push(pivot);
    e.rootNodes.forEach(r => (r.parent = pivot));
    for (const m of pivot.getChildMeshes(false)) {
      if (look.glow && hand === 'hand_r' && m.material instanceof PBRMaterial) m.material.emissiveColor = new Color3(...look.glow).scale(0.35);
      meshes.push(m);
    }
  };
  attach(look.weapon, 'hand_r');
  attach(look.offhand, 'hand_l');
  attach(look.helmet, 'Head', HEAD_FIT[look.body] ?? GRIPS.head);
  attach(look.cloak, 'spine_03', GRIPS.back);

  // 장식: 소품(q/acc/…)은 크기를 맞춰 뼈에, 빛 장식(fx:…)은 코드로 만든다
  const accColor = new Color3(...(look.glow ?? look.aura ?? [1, 0.85, 0.5]));
  const ticks: ((t: number) => void)[] = [];
  for (const key of look.acc ?? []) {
    const name = key.replace(/^(fx:|q\/acc\/)/, '');
    const fit = ACC_FIT[name];
    if (!fit) continue;
    const pivot = new TransformNode(`acc_${name}`, scene);
    pivot.parent = fit.bone ? boneNode(fit.bone) ?? bodyRoot : holder;
    pivot.position.set(...fit.pos);
    pivot.rotation.set(...fit.rot);
    owned.push(pivot);
    if (key.startsWith('fx:')) {
      const f = makeFxAcc(name, scene, accColor, fit.size);
      f.meshes.forEach(m => { m.parent = pivot; m.isPickable = false; });
      if (f.tick) ticks.push(f.tick);
      if (name === 'horns') meshes.push(...f.meshes);   // 뿔만 그림자를 드리운다
      continue;
    }
    const e = assets.container(key).instantiateModelsToScene(n => n, false, { doNotInstantiate: true });
    owned.push(e);
    const inner = new TransformNode(`acc_in_${name}`, scene);
    e.rootNodes.forEach(r => (r.parent = inner));
    inner.computeWorldMatrix(true);
    const bb = inner.getHierarchyBoundingVectors(true);
    const ext = bb.max.subtract(bb.min);
    const s = fit.size / Math.max(ext.x, ext.y, ext.z, 1e-4);
    const mid = bb.min.add(bb.max).scale(0.5);
    inner.scaling.setAll(s);
    inner.position.copyFrom(mid.scale(-s));
    inner.parent = pivot;
    owned.push(inner);
    meshes.push(...inner.getChildMeshes(false));
  }
  if (ticks.length) {
    const obs = scene.onBeforeRenderObservable.add(() => { const t = performance.now() / 1000; ticks.forEach(f => f(t)); });
    owned.push({ dispose: () => scene.onBeforeRenderObservable.remove(obs) });
  }

  // 4. 이펙트: 발밑 오라
  if (look.aura && fx) {
    const ps = new ParticleSystem('aura', 120, scene);
    ps.particleTexture = fx.flare;
    ps.emitter = holder as unknown as AbstractMesh;
    ps.isLocal = false;
    ps.createCylinderEmitter(0.55, 0.05, 0.5, 0);
    ps.emitRate = 26;
    ps.minLifeTime = 0.8; ps.maxLifeTime = 1.6;
    ps.minSize = 0.05; ps.maxSize = 0.14;
    ps.minEmitPower = 0.2; ps.maxEmitPower = 0.5;
    ps.gravity = new Vector3(0, 0.9, 0);
    const [r, g, b] = look.aura;
    ps.color1 = new Color4(r, g, b, 1);
    ps.color2 = new Color4(1, 1, 1, 0.8);
    ps.colorDead = new Color4(r * 0.3, g * 0.3, b * 0.3, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.start();
    owned.push(ps);
  }

  if (look.scale) bodyRoot.scaling.scaleInPlace(look.scale);

  for (const m of meshes) {
    m.isPickable = false;
    shadow?.addShadowCaster(m, false);
    const mat = m.material as PBRMaterial | null;
    if (mat && 'maxSimultaneousLights' in mat) mat.maxSimultaneousLights = 8;
  }

  // 5. 애니메이션: UAL 의 그룹을 뼈 이름으로 이 몸의 노드에 복제한다
  const nodes = new Map<string, TransformNode>();
  skel.bones.forEach(b => { const tn = b.getTransformNode(); if (tn) nodes.set(b.name, tn); });
  const anims = new Map<string, AnimationGroup>();
  for (const k of ANIM_KEYS) {
    if (!assets.has(k)) continue;
    for (const src of assets.container(k).animationGroups) {
      const g = src.clone(src.name, old => nodes.get((old as Node).name) ?? null);
      g.targetedAnimations.filter(t => !t.target || (POSE_ONLY.test(look.body) && t.animation.targetProperty === 'position')).forEach(t => g.removeTargetedAnimation(t.animation));
      anims.set(src.name, g);
    }
  }

  return {
    root: holder,
    anims,
    meshes,
    tall: BODY_TALL[look.body] ?? 1,
    find: name => holder.getDescendants(false).find(d => d.name === name),
    dispose: () => {
      anims.forEach(g => g.dispose());
      owned.forEach(o => o.dispose());
      holder.dispose();
    },
  };
}
