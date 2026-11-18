// 던전 전투장: 바닥·벽·소품(KayKit Dungeon), 조명·그림자·안개·후처리. 테마 2개(무덤 crypt, 고블린 굴 cave)를 다 지어 두고 켜고 끈다
import {
  Camera, Color3, Color4, DefaultRenderingPipeline, DirectionalLight, HemisphericLight, ImageProcessingConfiguration,
  LoadAssetContainerAsync, Matrix, Mesh, PBRMaterial, PointLight, Quaternion, Scene, ShadowGenerator, SpotLight, Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { Fx } from './fx';

type Place = [x: number, y: number, z: number, rotY?: number, scale?: number];

const PROPS = [
  'floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_big_grate', 'wall', 'wall_arched', 'pillar_decorated',
  'torch_mounted', 'barrel_large', 'box_stacked', 'banner_patternA_red', 'banner_shield_blue', 'chest_gold',
  'rubble_large', 'candle_triple', 'sword_shield_broken', 'coin_stack_large', 'column',
];

export type Theme = 'crypt' | 'cave';
// 테마별 바닥·뒷벽·가장자리 소품 (공통: 옆벽·윗벽·기둥·횃불·보물)
type Layout = Record<string, Place[]>;
function themeLayouts(back: number, side: number): Record<Theme, Layout> {
  const crypt: Layout = {}, cave: Layout = {};
  const add = (l: Layout, n: string, ...p: Place[]) => (l[n] ??= []).push(...p);
  const h = (x: number, z: number) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
  for (let x = -8; x <= 8; x += 4) {
    for (let z = -12; z <= 16; z += 4) {
      const r = h(x, z), rot = Math.floor(r * 4) * Math.PI / 2;
      const edge = Math.abs(x) === 8 || z >= 16 || z <= -12;
      // 무덤: 큰 돌 타일, 가장자리는 깨지고 풀 난 작은 타일
      if (x === 0 && z === 12) add(crypt, 'floor_tile_big_grate', [x, 0, z]);
      else if (edge && r < 0.55) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const k = h(x + dx, z + dz);
        add(crypt, k < 0.35 ? 'floor_tile_small_broken_A' : k < 0.6 ? 'floor_tile_small_weeds_A' : k < 0.8 ? 'floor_tile_small_broken_B' : 'floor_tile_small_weeds_B', [x + dx, 0, z + dz, Math.floor(k * 4) * Math.PI / 2]);
      }
      else add(crypt, edge && r < 0.75 ? 'floor_tile_large_rocks' : 'floor_tile_large', [x, 0, z, rot]);
      // 고블린 굴: 흙바닥, 뒤쪽 한 칸은 나무 판자
      if (z === 16 && Math.abs(x) <= 4) add(cave, 'floor_wood_large_dark', [x, 0, z, 0]);
      else if (edge && r < 0.5) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(cave, h(x + dx, z) < 0.5 ? 'floor_dirt_small_weeds' : 'floor_dirt_small_A', [x + dx, 0, z + dz, Math.floor(h(z, x + dx) * 4) * Math.PI / 2]);
      else add(cave, r < 0.35 ? 'floor_dirt_large_rocky' : 'floor_dirt_large', [x, 0, z, rot]);
    }
  }
  // 뒷벽 아래층 (가운데 아치는 공통)
  for (const [x, c, g] of [[-8, 'wall_cracked', 'wall_scaffold'], [-4, 'wall_archedwindow_gated', 'wall_gated'], [4, 'wall_archedwindow_gated', 'wall_scaffold'], [8, 'wall_broken', 'wall_cracked']] as const) {
    add(crypt, c, [x, 0, back, Math.PI]);
    add(cave, g, [x, 0, back, Math.PI]);
  }
  // 무덤 가장자리: 난간, 촛불 선반, 무너진 돌, 금빛 무기
  for (const sx of [-1, 1]) {
    for (const z of [6, 10, 14]) add(crypt, 'barrier', [sx * 7.4, 0, z, Math.PI / 2]);
    for (const z of [4, 8, 12, 16]) add(crypt, 'barrier_column', [sx * 7.4, 0, z]);
    add(crypt, 'shelf_small_candles', [sx * (side - 0.4), 0, 2, -sx * Math.PI / 2], [sx * (side - 0.4), 0, 12, -sx * Math.PI / 2]);
  }
  add(crypt, 'candle_lit', [-6.3, 0, 16.4], [-5.9, 0, 16.9], [6.1, 0, 16.6], [-8.6, 0, -6]);
  add(crypt, 'rubble_half', [-8.2, 0, -3, 0.6], [8.4, 0, 9, 2.1]);
  add(crypt, 'sword_shield_gold', [5.6, 0.05, 15.8, 0.6]);
  add(crypt, 'banner_triple_red', [-6, 4, back, Math.PI], [6, 4, back, Math.PI]);
  add(crypt, 'coin_stack_medium', [2.5, 0, 17, 0.5]);
  // 고블린 굴 가장자리: 상자, 술통, 부서진 탁자, 궤짝, 짚 침대, 깃발
  add(cave, 'crates_stacked', [-7.6, 0, 10, 0.3], [7.7, 0, 3, 1.4]);
  add(cave, 'barrel_small_stack', [7.4, 0, 12, 0.8], [-8.2, 0, -5, 0.2]);
  add(cave, 'keg_decorated', [-7.5, 0, 4, 1.2]);
  add(cave, 'table_long_broken', [-6.4, 0, 14.6, 0.25]);
  add(cave, 'table_medium_decorated_A', [6.4, 0, 8, 1.4]);
  add(cave, 'trunk_large_A', [6.6, 0, 15.7, Math.PI + 0.3]);
  add(cave, 'box_large', [8.2, 0, -6, 0.5]);
  add(cave, 'bed_floor', [7.6, 0, -1.5, 1.6]);
  add(cave, 'banner_patternC_brown', [-side, 0, 8, Math.PI / 2], [side, 0, 8, -Math.PI / 2]);
  add(cave, 'banner_shield_red', [-4, 4, back, Math.PI], [4, 4, back, Math.PI]);
  add(cave, 'torch_lit', [-5.6, 0, 16.6], [5.4, 0, 16.4]);
  return { crypt, cave };
}
// 테마별 바닥 색 (텍스처에 곱한다): 밝은 회색 타일이 캐릭터보다 튀지 않게 어둡게
const FLOOR_TINT: Record<Theme, [number, number, number]> = { crypt: [0.5, 0.48, 0.52], cave: [0.78, 0.62, 0.48] };
const FOG: Record<Theme, [number, number, number]> = { crypt: [0.035, 0.035, 0.06], cave: [0.06, 0.035, 0.025] };
const HEMI: Record<Theme, [number, number, number]> = { crypt: [0.6, 0.68, 1], cave: [1, 0.78, 0.6] };

/** 같은 소품을 thin instance 로 여러 개 찍는다. 만든 메시를 돌려준다 */
async function stamp(scene: Scene, name: string, places: Place[], receive = true): Promise<Mesh[]> {
  if (!places.length) return [];
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
  return c.meshes.filter((m): m is Mesh => m instanceof Mesh && !m.isDisposed());
}

export interface Arena { shadow: ShadowGenerator; update(dt: number): void; setTheme(t: Theme): void }

export async function buildArena(scene: Scene, fx: Fx, mobile: boolean): Promise<Arena> {
  scene.clearColor = new Color4(0.035, 0.03, 0.05, 1);
  scene.ambientColor = new Color3(0.2, 0.2, 0.25);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.014;
  scene.fogColor = new Color3(0.035, 0.03, 0.05);

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;
  hemi.diffuse = new Color3(0.6, 0.66, 0.95);
  hemi.groundColor = new Color3(0.2, 0.13, 0.1);

  const sun = new DirectionalLight('sun', new Vector3(0.35, -1, 0.5).normalize(), scene);
  sun.position = new Vector3(-8, 20, -12);
  sun.intensity = 2.6;
  sun.diffuse = new Color3(1, 0.9, 0.78);
  const shadow = new ShadowGenerator(mobile ? 1024 : 2048, sun);
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias = 0.002;
  shadow.normalBias = 0.02;
  shadow.darkness = 0.25;
  // 뒤에서 비추는 차가운 빛: 캐릭터 윤곽이 배경에서 떨어져 보이게 (그림자 없음)
  const rim = new DirectionalLight('rim', new Vector3(-0.25, -0.55, -1).normalize(), scene);
  rim.intensity = 1.6;
  rim.diffuse = new Color3(0.55, 0.7, 1);
  rim.specular = new Color3(0.4, 0.5, 0.8);
  // 전장 가운데를 밝히는 위쪽 조명: 가장자리는 어둡고 싸우는 곳은 밝게
  const stage = new SpotLight('stage', new Vector3(0, 16, 1), new Vector3(0, -1, 0.12), 1.1, 2, scene);
  stage.intensity = 1.2;
  stage.diffuse = new Color3(1, 0.95, 0.85);
  stage.specular = Color3.Black();

  // 벽: 뒤쪽 z=18 (앞면이 카메라 쪽), 양옆 x=±10. 바닥: x -8..8, z -12..16 (4x4 타일, 테마별)
  const back = 18, side = 10;
  const walls: Place[] = [], arched: Place[] = [];
  // 2층으로 쌓아 화면 위쪽까지 벽이 차게 한다 (뒷벽 아래층 양옆 4칸은 테마별)
  for (const y of [0, 4]) {
    for (let x = -8; x <= 8; x += 4) if (y === 4 || x === 0) (x === 0 && y === 0 ? arched : walls).push([x, y, back, Math.PI]);
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
    wall: walls,
    wall_arched: arched,
    pillar_decorated: [[-side + 0.6, 0, back - 0.6, Math.PI / 4], [side - 0.6, 0, back - 0.6, -Math.PI / 4], [-side + 0.6, 4, back - 0.6, Math.PI / 4], [side - 0.6, 4, back - 0.6, -Math.PI / 4], [-7.2, 0, 4, Math.PI / 2], [7.2, 0, 4, -Math.PI / 2], [-7.2, 0, 12, Math.PI / 2], [7.2, 0, 12, -Math.PI / 2]],
    torch_mounted: torchSpots.map(t => t.place),
    banner_patternA_red: [[-4, 0, back, Math.PI], [4, 0, back, Math.PI]],
    banner_shield_blue: [[-side, 0, 0, Math.PI / 2], [side, 0, 0, -Math.PI / 2], [0, 3.4, back, Math.PI]],
    barrel_large: [[-8.4, 0, -8, 0.3], [-7.6, 0, -9.8, 1.2]],
    box_stacked: [[7.8, 0, -9, 0.4]],
    rubble_large: [[-8.2, 0, 16.2, 0.2, 0.8]],
    chest_gold: [[0, 0, 16.3, Math.PI]],
    coin_stack_large: [[1.7, 0, 16.4, 0.4], [-1.6, 0, 16.6, 1.8, 0.8]],
    candle_triple: [[2.9, 0, 16.6, 0], [-2.9, 0, 16.6, 1]],
    sword_shield_broken: [[-3.4, 0.05, 2.5, 0.5], [4.6, 0.05, -6, 2.2], [3.2, 0.05, 9.5, 4]],
    column: [[-5.5, 0, -10.5, 0], [5.5, 0, -10.5, 0]],
  };
  await Promise.all(PROPS.map(n => stamp(scene, n, placements[n] ?? [])));
  // 테마: 모두 지어 두고 하나만 켠다
  const layouts = themeLayouts(back, side);
  const groups: Record<Theme, Mesh[]> = { crypt: [], cave: [] };
  await Promise.all((Object.keys(layouts) as Theme[]).flatMap(t => Object.entries(layouts[t]).map(async ([n, ps]) => {
    const ms = await stamp(scene, n, ps);
    // 바닥은 어둡게 물들인다 (재질을 따로 둬 다른 소품에 번지지 않게)
    if (n.startsWith('floor_')) for (const m of ms) if (m.material instanceof PBRMaterial) { m.material = m.material.clone(`${n}_${t}`); (m.material as PBRMaterial).albedoColor = new Color3(...FLOOR_TINT[t]); }
    groups[t].push(...ms);
  })));
  for (const [x, , z] of layouts.cave.torch_lit) fx.fire(new Vector3(x, 1.55, z), 0.8);
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
  // 소품 재질은 기본 조명 4개까지만 받는다: 해·하늘·뒤·위 + 횃불까지 다 받게
  for (const m of scene.materials) if ('maxSimultaneousLights' in m) (m as { maxSimultaneousLights: number }).maxSimultaneousLights = 10;
  // 촛불
  for (const [x, , z] of placements.candle_triple) fx.fire(new Vector3(x + 0.05, 0.95, z), 0.35);
  fx.embers();

  let t = 0;
  const setTheme = (th: Theme) => {
    for (const k of Object.keys(groups) as Theme[]) groups[k].forEach(m => m.setEnabled(k === th));
    scene.fogColor = new Color3(...FOG[th]);
    scene.clearColor = new Color4(...FOG[th], 1);
    hemi.diffuse = new Color3(...HEMI[th]);
  };
  setTheme('crypt');
  return {
    shadow,
    setTheme,
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
  ip.exposure = 1.3;
  ip.contrast = 1.12;
  ip.vignetteEnabled = true;
  ip.vignetteWeight = 1.3;
  ip.vignetteColor = new Color4(0.02, 0.01, 0.04, 0);
  ip.vignetteCameraFov = 0.6;
  // 색수차·필름 입자는 화면을 흐리게 해서 뺐다. 대신 윤곽을 살짝 세운다
  p.sharpenEnabled = true;
  p.sharpen.edgeAmount = 0.25;
  return p;
}
