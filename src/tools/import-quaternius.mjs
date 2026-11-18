// Quaternius 조합형 캐릭터·애니메이션과 무기 팩 원본(data/)을 게임용 glb(public/assets/q/)로 바꾼다.
// - 텍스처는 webp 로, 캐릭터 1024 / 무기 512 로 줄인다 (원본 4096)
// - 인간 몸(Superhero)은 옷을 입히면 머리만 필요하므로 머리·목 삼각형만 남긴 판을 만든다
// - 옷 파츠의 색 텍스처는 밝힌다 (원본이 어두워 등 쪽이 검게 보인다): 어두운 곳을 더 올리는 감마 PART_LIFT
// - 애니메이션은 src/data.ts·heroes.ts 에 이름이 나오는 것만 남기고 마네킹 메시는 뺀다
// - 무기·애니메이션은 meshopt 압축 (Babylon 디코더: public/meshopt_decoder.js). 뼈대 있는 메시는 압축하지 않는다(아래 설명)
// 실행: npm run import-q
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const Q = 'data/quaternius';
const OUT = 'public/assets/q';
const BASE = `${Q}/base/Universal Base Characters[Standard]`;
const OUTFIT = `${Q}/outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts`;
const RACES = `${Q}/races/Characters - Fantasy Races Kit[Standard]/Exports/GLB (Godot-Unreal)`;
const BEAST = `${Q}/bestiary/Bestiary - Dungeon Monsters Kit[Standard]/Exports/GLB (Godot-Unreal)`;
const UAL1 = `${Q}/ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`;
const UAL2 = `${Q}/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb`;
const BINBUN = 'data/weapons/rpg-weapons/Free/GLTF';
const KAYKIT_W = 'data/weapons/fantasy-weapons-bits/KayKit_FantasyWeaponsBits_1.0_FREE/Assets/gltf';

const usedNames = new Set([...['src/data.ts', 'src/heroes.ts', 'src/enemies.ts'].map(f => fs.readFileSync(f, 'utf8')).join('\n').matchAll(/'([A-Za-z0-9_]+)'/g)].map(m => m[1]));
const only = process.argv[2];   // 예: npm run import-q -- weapon  (한 종류만 다시 만들 때)

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const jobs = [];
const add = (kind, src, name) => jobs.push({ kind, src, dst: `${OUT}/${kind}/${name}.glb` });
const list = (dir, re) => fs.readdirSync(dir).filter(f => re.test(f));

add('head', `${BASE}/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`, 'Human_Male');
add('head', `${BASE}/Base Characters/Godot - UE/Superhero_Female_FullBody.gltf`, 'Human_Female');
add('body', `${BASE}/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`, 'Human_Male_Full');
add('body', `${BASE}/Base Characters/Godot - UE/Superhero_Female_FullBody.gltf`, 'Human_Female_Full');
for (const f of list(RACES, /\.glb$/)) add('body', `${RACES}/${f}`, f.replace('.glb', ''));
for (const f of list(BEAST, /\.glb$/)) add('body', `${BEAST}/${f}`, f.replace('.glb', ''));
for (const f of list(`${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`, /\.gltf$/)) add('hair', `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/${f}`, f.replace('.gltf', ''));
for (const f of list(OUTFIT, /\.gltf$/)) add('part', `${OUTFIT}/${f}`, f.replace('.gltf', ''));
add('anim', UAL1, 'UAL1');
add('anim', UAL2, 'UAL2');
for (const d of fs.readdirSync(BINBUN)) for (const f of list(`${BINBUN}/${d}`, /^[A-Za-z_]+_\d\d\.glb$/)) add('weapon', `${BINBUN}/${d}/${f}`, f.replace('.glb', ''));
for (const f of list(KAYKIT_W, /\.gltf$/)) add('weapon', `${KAYKIT_W}/${f}`, `kk_${f.replace('.gltf', '')}`);

// 장비(투구·모자·망토): KayKit 캐릭터에 뼈로 고정된 메시를 떼어 낸다. 붙일 뼈는 게임이 이름으로 정한다(Head / spine_03)
const KK = 'data/kaykit';
const GEAR = [
  ['characters/Knight', 'Knight_Helmet'], ['characters/Knight', 'Knight_Cape'],
  ['characters/Mage', 'Mage_Hat'], ['characters/Mage', 'Mage_Cape'],
  ['characters/Barbarian', 'Barbarian_Hat'], ['characters/Barbarian', 'Barbarian_Cape'],
  ['characters/Rogue', 'Rogue_Cape'],
  ['enemies/Skeleton_Warrior', 'Skeleton_Warrior_Helmet'], ['enemies/Skeleton_Mage', 'Skeleton_Mage_Hat'],
  ['enemies/Skeleton_Rogue', 'Skeleton_Rogue_Hood'], ['enemies/Skeleton_Rogue', 'Skeleton_Rogue_Cape'],
];
for (const [file, node] of GEAR) jobs.push({ kind: 'gear', src: `${KK}/${file}.glb`, dst: `${OUT}/gear/${node}.glb`, node });

/** 옷 파츠 색 텍스처를 감마로 밝힌다 (알파는 그대로) */
const PART_LIFT = 0.6;
async function liftBaseColor(doc) {
  const lut = Uint8Array.from({ length: 256 }, (_, v) => Math.round(255 * Math.pow(v / 255, PART_LIFT)));
  const texs = new Set(doc.getRoot().listMaterials().map(m => m.getBaseColorTexture()).filter(Boolean));
  for (const t of texs) {
    const { data, info } = await sharp(t.getImage()).raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i++) if (info.channels < 4 || i % 4 !== 3) data[i] = lut[data[i]];
    t.setImage(await sharp(data, { raw: info }).png().toBuffer()).setMimeType('image/png');
  }
}

/** 머리·목 뼈에 주로 붙은 삼각형만 남긴다 (나머지 몸은 옷 파츠가 덮는다) */
function keepHead(doc) {
  const skin = doc.getRoot().listSkins()[0];
  const headJoints = new Set(skin.listJoints().map((j, i) => (/^(Head|neck_01)$/.test(j.getName()) ? i : -1)).filter(i => i >= 0));
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), I = prim.getIndices();
      if (!J || !W || !I) continue;
      const n = J.getCount(), head = new Float32Array(n), j = [], w = [];
      for (let v = 0; v < n; v++) {
        J.getElement(v, j); W.getElement(v, w);
        for (let k = 0; k < 4; k++) if (headJoints.has(j[k])) head[v] += w[k];
      }
      const src = I.getArray(), keep = [];
      for (let t = 0; t < src.length; t += 3) {
        if (head[src[t]] > 0.5 && head[src[t + 1]] > 0.5 && head[src[t + 2]] > 0.5) keep.push(src[t], src[t + 1], src[t + 2]);
      }
      I.setArray(new Uint32Array(keep));
      compactPrimitive(prim);
    }
  }
}

/** 장비: 이름이 node 인 메시 하나만, 부모 뼈 기준 위치 그대로 남긴다 */
function gearOnly(doc, name) {
  const root = doc.getRoot();
  const src = root.listNodes().find(n => n.getName() === name);
  if (!src) throw new Error(`없는 노드 ${name}`);
  const parent = src.getParentNode()?.getName();
  const node = doc.createNode(name).setMesh(src.getMesh()).setTranslation(src.getTranslation()).setRotation(src.getRotation()).setScale(src.getScale());
  for (const a of root.listAnimations()) { a.listSamplers().forEach(x => x.dispose()); a.listChannels().forEach(x => x.dispose()); a.dispose(); }
  const scene = root.listScenes()[0];
  scene.listChildren().forEach(c => scene.removeChild(c));
  scene.addChild(node);
  for (const n of root.listNodes()) if (n !== node) n.dispose();
  root.listSkins().forEach(sk => sk.dispose());
  return parent;
}

/** 애니메이션 파일: 마네킹 메시를 빼고, 쓰는 동작만 남긴다 */
function animOnly(doc) {
  const root = doc.getRoot();
  for (const node of root.listNodes()) if (node.getMesh()) { node.setMesh(null); node.setSkin(null); }
  for (const a of root.listAnimations()) {
    if (usedNames.has(a.getName())) continue;
    a.listSamplers().forEach(s => s.dispose());
    a.listChannels().forEach(c => c.dispose());
    a.dispose();
  }
}

let before = 0, after = 0, n = 0;
for (const job of jobs) {
  if (only && job.kind !== only) continue;
  if (!fs.existsSync(job.src)) { console.log('없음', job.src); continue; }
  const doc = await io.read(job.src);
  if (job.kind === 'head') keepHead(doc);
  if (job.kind === 'anim') animOnly(doc);
  if (job.kind === 'part') await liftBaseColor(doc);
  if (job.kind === 'gear') job.parent = gearOnly(doc, job.node);
  const tex = ['weapon', 'gear'].includes(job.kind) ? 512 : 1024;
  await doc.transform(
    ...(job.kind === 'anim' ? [resample()] : []),
    dedup(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] }),
    // 뼈대가 있는 몸·헤어·파츠는 좌표 압축(quantize)을 하지 않는다. 압축 배율이 각 파일의 뼈대 행렬에 들어가서,
    // 파츠를 다른 몸의 뼈대로 옮겨 붙이면 크기가 어긋난다. 무기·애니메이션만 meshopt 로 압축한다.
    ...(['weapon', 'anim', 'gear'].includes(job.kind) ? [meshopt({ encoder: MeshoptEncoder, level: 'medium' })] : []),
  );
  fs.mkdirSync(path.dirname(job.dst), { recursive: true });
  await io.write(job.dst, doc);
  const dir = path.dirname(job.src);
  const srcSize = fs.statSync(job.src).size + (job.src.endsWith('.gltf')
    ? fs.readdirSync(dir).filter(f => f.startsWith(path.basename(job.src, '.gltf')) && f.endsWith('.bin')).reduce((s, f) => s + fs.statSync(`${dir}/${f}`).size, 0) : 0);
  before += srcSize;
  after += fs.statSync(job.dst).size;
  n++;
  if (job.kind === 'gear') console.log(`gear   ${job.node} ← 부모 뼈 ${job.parent}`);
  else if (job.kind !== 'weapon') console.log(`${job.kind.padEnd(6)} ${path.basename(job.dst).padEnd(34)} ${(fs.statSync(job.dst).size / 1024).toFixed(0).padStart(6)}KB  anims ${doc.getRoot().listAnimations().length}`);
}
console.log(`${n}개, 메시·애니메이션 원본 ${(before / 1048576).toFixed(1)}MB(텍스처 별도) → ${(after / 1048576).toFixed(1)}MB`);
