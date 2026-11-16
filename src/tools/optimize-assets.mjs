// 원본 모델(data/kaykit)을 줄여 public/assets 에 쓴다.
// - 모델마다 게임이 쓰는 애니메이션만 남긴다 (src/data.ts 의 animsByModel, 76~95개 → 6~11개)
// - 키프레임 정리, 중복 제거, 안 쓰는 데이터 제거, meshopt 압축 (메시·애니메이션)
// - .gltf(+bin+png) 는 .glb 한 파일로 합친다
// - 브라우저용 meshopt 디코더를 public/meshopt_decoder.js 로 복사한다 (Babylon 이 CDN 대신 이것을 쓴다)
// 실행: npm run assets
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';
import { animsByModel } from '../data.ts';

const SRC = 'data/kaykit';
const OUT = 'public/assets';
const keep = animsByModel();

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

fs.rmSync(OUT, { recursive: true, force: true });
const files = fs.readdirSync(SRC, { recursive: true }).filter(f => /\.(glb|gltf)$/.test(f));
const sizeOf = f => fs.statSync(f).size;
let before = 0, after = 0;
for (const rel of files) {
  const model = path.basename(rel).replace(/\.(glb|gltf)$/, '');
  if (rel.startsWith('characters') && !keep.has(model)) continue;   // 게임에 안 나오는 영웅은 뺀다
  const src = path.join(SRC, rel);
  const dst = path.join(OUT, rel).replace(/\.gltf$/, '.glb');
  const doc = await io.read(src);
  const anims = keep.get(model) ?? new Set();
  for (const a of doc.getRoot().listAnimations()) {
    if (anims.has(a.getName())) continue;
    // 애니메이션만 지우면 샘플러가 남아 키프레임 배열을 붙잡는다
    a.listSamplers().forEach(s => s.dispose());   // 키프레임 배열은 공유될 수 있어 prune 이 정리한다
    a.listChannels().forEach(c => c.dispose());
    a.dispose();
  }
  await doc.transform(resample(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  await io.write(dst, doc);
  const b = rel.endsWith('.gltf') ? sizeOf(src) + sizeOf(src.replace(/\.gltf$/, '.bin')) : sizeOf(src);
  before += b;
  after += sizeOf(dst);
  console.log(`${rel.padEnd(46)} ${(b / 1024).toFixed(0).padStart(6)}KB → ${(sizeOf(dst) / 1024).toFixed(0).padStart(5)}KB  anims ${doc.getRoot().listAnimations().length}`);
}
fs.copyFileSync('node_modules/meshoptimizer/meshopt_decoder.cjs', 'public/meshopt_decoder.js');
console.log(`합계 ${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB`);
