// 조합형 영웅 모델: 몸(얼굴) + 의상 파츠 + 헤어를 한 스켈레톤에 붙이고, 무기·이펙트를 얹고, 공용 애니메이션(UAL)을 연결한다
import {
  AbstractMesh, AnimationGroup, Color3, Color4, Node, ParticleSystem, PBRMaterial, Scene, ShadowGenerator,
  TransformNode, Vector3,
} from '@babylonjs/core';
import type { Assets, ModelInstance } from './assets';
import type { Look } from './data';
import type { Fx } from './fx';

export const ANIM_KEYS = ['q/anim/UAL1', 'q/anim/UAL2'];
export const lookKeys = (l: Look) => [l.body, ...(l.parts ?? []), ...(l.hair ?? []), l.weapon, l.offhand, l.helmet, l.cloak].filter((k): k is string => !!k);

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
