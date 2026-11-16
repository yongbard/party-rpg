// 던전 전투장: 바닥·벽·소품(KayKit Dungeon), 조명·그림자·안개·후처리
import {
  Camera, Color3, Color4, DefaultRenderingPipeline, DirectionalLight, HemisphericLight, ImageProcessingConfiguration,
  LoadAssetContainerAsync, Matrix, Mesh, PointLight, Quaternion, Scene, ShadowGenerator, Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { Fx } from './fx';

type Place = [x: number, y: number, z: number, rotY?: number, scale?: number];

const PROPS = [
  'floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_big_grate', 'wall', 'wall_arched', 'pillar_decorated',
  'torch_mounted', 'barrel_large', 'box_stacked', 'banner_patternA_red', 'banner_shield_blue', 'chest_gold',
  'rubble_large', 'candle_triple', 'sword_shield_broken', 'coin_stack_large', 'column',
];

/** 같은 소품을 thin instance 로 여러 개 찍는다 */
async function stamp(scene: Scene, name: string, places: Place[], receive = true) {
  if (!places.length) return;
  const c = await LoadAssetContainerAsync(`assets/dungeon/${name}.glb`, scene);
  c.addAllToScene();
  for (const m of c.meshes) {
    if (!(m instanceof Mesh) || m.getTotalVertices() === 0) continue;
    const local = m.computeWorldMatrix(true).clone();
    m.setParent(null);
    m.position.setAll(0); m.rotationQuaternion = Quaternion.Identity(); m.scaling.setAll(1);
    for (const [x, y, z, r = 0, s = 1] of places) {
      const p = Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationYawPitchRoll(r, 0, 0), new Vector3(x, y, z));
      m.thinInstanceAdd(local.multiply(p));
    }
    m.thinInstanceRefreshBoundingInfo();
    m.receiveShadows = receive;
    m.isPickable = false;
    m.freezeWorldMatrix();
  }
  c.meshes.filter(m => m.getTotalVertices() === 0).forEach(m => m.dispose());
}

export interface Arena { shadow: ShadowGenerator; update(dt: number): void }

export async function buildArena(scene: Scene, fx: Fx, mobile: boolean): Promise<Arena> {
  scene.clearColor = new Color4(0.035, 0.03, 0.05, 1);
  scene.ambientColor = new Color3(0.2, 0.2, 0.25);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.022;
  scene.fogColor = new Color3(0.035, 0.03, 0.05);

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.5;
  hemi.diffuse = new Color3(0.6, 0.66, 0.95);
  hemi.groundColor = new Color3(0.2, 0.13, 0.1);

  const sun = new DirectionalLight('sun', new Vector3(0.35, -1, 0.5).normalize(), scene);
  sun.position = new Vector3(-8, 20, -12);
  sun.intensity = 2.2;
  sun.diffuse = new Color3(1, 0.9, 0.78);
  const shadow = new ShadowGenerator(mobile ? 1024 : 2048, sun);
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias = 0.002;
  shadow.normalBias = 0.02;
  shadow.darkness = 0.25;

  // 바닥: x -8..8, z -12..16 (4x4 타일)
  const floor: Place[] = [], rocks: Place[] = [], grate: Place[] = [];
  for (let x = -8; x <= 8; x += 4) {
    for (let z = -12; z <= 16; z += 4) {
      const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
      if (x === 0 && z === 12) grate.push([x, 0, z]);
      else if (h < 0.3 && Math.abs(x) === 8) rocks.push([x, 0, z, Math.floor(h * 40) * Math.PI / 2]);
      else floor.push([x, 0, z, Math.floor(h * 4) * Math.PI / 2]);
    }
  }

  // 벽: 뒤쪽 z=18 (앞면이 카메라 쪽), 양옆 x=±10
  const back = 18, side = 10;
  const walls: Place[] = [], arched: Place[] = [];
  // 2층으로 쌓아 화면 위쪽까지 벽이 차게 한다
  for (const y of [0, 4]) {
    for (let x = -8; x <= 8; x += 4) (x === 0 && y === 0 ? arched : walls).push([x, y, back, Math.PI]);
    for (let z = -12; z <= 16; z += 4) {
      walls.push([-side, y, z, Math.PI / 2]);
      walls.push([side, y, z, -Math.PI / 2]);
    }
  }

  const torchSpots: { pos: Vector3; place: Place; light: boolean }[] = [
    { pos: new Vector3(-side + 0.5, 2.4, -2), place: [-side + 0.5, 2.4, -2, Math.PI / 2], light: true },
    { pos: new Vector3(side - 0.5, 2.4, -2), place: [side - 0.5, 2.4, -2, -Math.PI / 2], light: true },
    { pos: new Vector3(-side + 0.5, 2.4, 8), place: [-side + 0.5, 2.4, 8, Math.PI / 2], light: false },
    { pos: new Vector3(side - 0.5, 2.4, 8), place: [side - 0.5, 2.4, 8, -Math.PI / 2], light: false },
    { pos: new Vector3(-2.3, 2.4, back - 0.5), place: [-2.3, 2.4, back - 0.5, Math.PI], light: true },
    { pos: new Vector3(2.3, 2.4, back - 0.5), place: [2.3, 2.4, back - 0.5, Math.PI], light: true },
  ];

  const placements: Record<string, Place[]> = {
    floor_tile_large: floor,
    floor_tile_large_rocks: rocks,
    floor_tile_big_grate: grate,
    wall: walls,
    wall_arched: arched,
    pillar_decorated: [[-side + 0.6, 0, back - 0.6, Math.PI / 4], [side - 0.6, 0, back - 0.6, -Math.PI / 4], [-side + 0.6, 4, back - 0.6, Math.PI / 4], [side - 0.6, 4, back - 0.6, -Math.PI / 4], [-7.2, 0, 4, Math.PI / 2], [7.2, 0, 4, -Math.PI / 2], [-7.2, 0, 12, Math.PI / 2], [7.2, 0, 12, -Math.PI / 2]],
    torch_mounted: torchSpots.map(t => t.place),
    banner_patternA_red: [[-4, 0, back, Math.PI], [4, 0, back, Math.PI]],
    banner_shield_blue: [[-side, 0, 0, Math.PI / 2], [side, 0, 0, -Math.PI / 2], [0, 3.4, back, Math.PI]],
    barrel_large: [[-8.4, 0, -8, 0.3], [-7.6, 0, -9.8, 1.2], [8.3, 0, 14.6, 0.5]],
    box_stacked: [[7.8, 0, -9, 0.4]],
    rubble_large: [[-6.5, 0, 16.2, 0.2, 0.8]],
    chest_gold: [[0, 0, 16.3, Math.PI]],
    coin_stack_large: [[1.7, 0, 16.4, 0.4], [-1.6, 0, 16.6, 1.8, 0.8]],
    candle_triple: [[2.9, 0, 16.6, 0], [-2.9, 0, 16.6, 1]],
    sword_shield_broken: [[-3.4, 0.05, 2.5, 0.5], [4.6, 0.05, -6, 2.2], [3.2, 0.05, 9.5, 4]],
    column: [[-5.5, 0, -10.5, 0], [5.5, 0, -10.5, 0]],
  };
  await Promise.all(PROPS.map(n => stamp(scene, n, placements[n] ?? [])));

  // 횃불: 불꽃 파티클 + 일부는 점광원
  const lights: { l: PointLight; base: number; seed: number }[] = [];
  for (const t of torchSpots) {
    const flame = t.pos.add(new Vector3(0, 0.62, 0)).add(new Vector3(Math.sign(-t.pos.x) * 0.25 * (Math.abs(t.pos.x) > 9 ? 1 : 0), 0, t.pos.z > 17 ? -0.25 : 0));
    fx.fire(flame);
    if (t.light) {
      const l = new PointLight('torch', flame, scene);
      l.diffuse = new Color3(1, 0.55, 0.25);
      l.specular = new Color3(0.4, 0.2, 0.1);
      l.range = 11;
      l.intensity = 2.2;
      lights.push({ l, base: 2.2, seed: Math.random() * 100 });
    }
  }
  // 촛불
  for (const [x, , z] of placements.candle_triple) fx.fire(new Vector3(x + 0.05, 0.95, z), 0.35);
  fx.embers();

  let t = 0;
  return {
    shadow,
    update(dt: number) {
      t += dt;
      for (const L of lights) {
        const n = Math.sin(t * 9 + L.seed) * 0.5 + Math.sin(t * 23 + L.seed * 2) * 0.3 + Math.sin(t * 3.1 + L.seed) * 0.2;
        L.l.intensity = L.base * (0.88 + n * 0.12);
      }
    },
  };
}

export function setupPost(scene: Scene, cams: Camera[], mobile: boolean) {
  const p = new DefaultRenderingPipeline('post', true, scene, cams);
  p.samples = mobile ? 1 : 4;
  p.fxaaEnabled = mobile;
  p.bloomEnabled = true;
  p.bloomThreshold = 0.75;
  p.bloomWeight = 0.45;
  p.bloomKernel = 64;
  p.bloomScale = 0.5;
  p.imageProcessingEnabled = true;
  const ip = p.imageProcessing;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.25;
  ip.contrast = 1.18;
  ip.vignetteEnabled = true;
  ip.vignetteWeight = 2.2;
  ip.vignetteColor = new Color4(0.02, 0.01, 0.04, 0);
  ip.vignetteCameraFov = 0.6;
  p.chromaticAberrationEnabled = !mobile;
  p.chromaticAberration.aberrationAmount = 12;
  p.grainEnabled = true;
  p.grain.intensity = 6;
  p.grain.animated = true;
  return p;
}
