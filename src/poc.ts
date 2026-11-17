// 기술 검증: Quaternius 베이스 몸 + 머리카락 + 의상 파츠를 한 스켈레톤으로 조립하고 UAL 애니메이션을 재생한다
// 주소: /poc.html?outfit=Ranger|Peasant&anim=Sword_Idle&n=1&fps
import {
  AbstractMesh, AnimationGroup, ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight,
  LoadAssetContainerAsync, Scene, ShadowGenerator, TransformNode, Vector3, MeshBuilder, StandardMaterial,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const q = new URLSearchParams(location.search);
const outfit = q.get('outfit') ?? 'Ranger';
const animName = q.get('anim') ?? 'Sword_Idle';
const count = Number(q.get('n') ?? 1);
const log = (s: string) => { document.getElementById('log')!.textContent += s + '\n'; console.log(s); };

const canvas = document.getElementById('c') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.08, 0.08, 0.1, 1);
const cam = new ArcRotateCamera('cam', Math.PI / 2, 1.3, count > 1 ? 4.2 + count * 0.9 : 4.2, new Vector3(0, 0.95, 0), scene);
cam.attachControl(canvas, true);
cam.wheelPrecision = 50;
new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.7;
const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.6), scene);
sun.position = new Vector3(5, 10, -5);
sun.intensity = 1.6;
const shadow = new ShadowGenerator(1024, sun);
const ground = MeshBuilder.CreateGround('g', { width: 20, height: 20 }, scene);
const gm = new StandardMaterial('gm', scene);
gm.diffuseColor = new Color3(0.2, 0.2, 0.24);
ground.material = gm;
ground.receiveShadows = true;

const PARTS: Record<string, string[]> = {
  Ranger: ['Male_Ranger_Body', 'Male_Ranger_Arms', 'Male_Ranger_Legs', 'Male_Ranger_Feet_Boots', 'Male_Ranger_Head_Hood', 'Male_Ranger_Acc_Pauldron'],
  Peasant: ['Male_Peasant_Body', 'Male_Peasant_Arms', 'Male_Peasant_Legs', 'Male_Peasant_Feet'],
};

async function load(url: string) {
  const c = await LoadAssetContainerAsync(url, scene);
  return c;
}

/** 베이스 몸 하나를 만들고, 파츠들을 그 스켈레톤에 붙인다 */
async function buildHero(x: number) {
  const t0 = performance.now();
  const body = await load('poc/base/Superhero_Male_FullBody.gltf');
  body.addAllToScene();
  const skel = body.skeletons[0];
  const root = body.meshes.find(m => m.name === '__root__') ?? body.meshes[0];
  root.position.x = x;
  const bodyMeshes = body.meshes.filter(m => m.skeleton);
  // 의상을 입히면 몸은 머리만 남긴다 (Readme: 전신을 쓰면 겹친다)
  const nameOf = (m: AbstractMesh) => m.name;
  log(`body meshes: ${bodyMeshes.map(nameOf).join(', ')}`);
  for (const m of bodyMeshes) if (!/Face|Eye|Hair|Head/i.test(m.name) && !/Sphere/.test(m.name)) m.setEnabled(false);

  const attach = async (url: string) => {
    const c = await load(url);
    c.addAllToScene();
    const own = c.skeletons[0];
    for (const m of c.meshes) {
      if (!m.skeleton) continue;
      m.skeleton = skel;          // 같은 65관절 릭이라 몸의 스켈레톤을 그대로 쓴다
      m.parent = root;
      shadow.addShadowCaster(m);
    }
    // 파츠가 들고 온 자기 스켈레톤·노드는 버린다
    const partRoot = c.meshes.find(m => m.name === '__root__');
    own?.dispose();
    c.transformNodes.forEach(t => { if (!t.isDisposed()) t.dispose(); });
    partRoot?.dispose();
  };
  await attach('poc/hair/Hair_Long.gltf');
  for (const p of PARTS[outfit] ?? []) await attach(`poc/parts/${p}.gltf`);
  bodyMeshes.forEach(m => shadow.addShadowCaster(m));
  log(`hero built in ${(performance.now() - t0).toFixed(0)}ms, bones ${skel.bones.length}`);
  return { body, skel, root };
}

async function main() {
  const heroes: Awaited<ReturnType<typeof buildHero>>[] = [];
  for (let i = 0; i < count; i++) heroes.push(await buildHero((i - (count - 1) / 2) * 1.2));

  // 애니메이션: 마네킹을 겨냥한 그룹을 각 영웅의 같은 이름 노드로 바꿔 복제한다
  const ual = await load('poc/anim/UAL1_Standard.glb');
  log(`anims: ${ual.animationGroups.length}: ${ual.animationGroups.map(g => g.name).slice(0, 8).join(', ')} …`);
  const src = ual.animationGroups.find(g => g.name === animName) ?? ual.animationGroups[0];
  heroes.forEach((h, i) => {
    const nodes = new Map<string, TransformNode>();
    h.skel.bones.forEach(b => { const tn = b.getTransformNode(); if (tn) nodes.set(b.name, tn); });
    const g: AnimationGroup = src.clone(`${src.name}_${i}`, old => nodes.get((old as TransformNode).name) ?? null);
    g.targetedAnimations.filter(t => !t.target).forEach(t => g.removeTargetedAnimation(t.animation));
    g.start(true, 1);
    if (i === 0) log(`playing ${src.name}, targets ${g.targetedAnimations.length}/${src.targetedAnimations.length}`);
  });
  ual.dispose();

  const total = scene.meshes.reduce((s, m) => s + (m.isEnabled() ? m.getTotalIndices() / 3 : 0), 0);
  log(`meshes ${scene.meshes.length}, tris ${Math.round(total)}, draw calls ~${scene.meshes.filter(m => m.isEnabled() && m.getTotalIndices() > 0).length}`);
  (window as unknown as { poc: unknown }).poc = { scene, heroes };
  engine.runRenderLoop(() => {
    scene.render();
    if (q.has('fps')) document.title = `${engine.getFps().toFixed(0)} fps`;
  });
  window.addEventListener('resize', () => engine.resize());
}
main().catch(e => log('ERR ' + (e?.stack ?? e)));
