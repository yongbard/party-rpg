// 외형 확인 페이지: 영웅 한 명의 등급별 외형을 한 줄로 세운다
// 주소: /poc.html?hero=leon&anim=Sword_Block  (anim 생략 시 영웅 대기 동작)
//       무기 각도 맞춤: &grip=blade:0,0,90:0.03,0.09,0.02  (도, m)
import { ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight, MeshBuilder, MeshoptCompression, Scene, ShadowGenerator, StandardMaterial, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { Assets } from './assets';
import { GRADES, HEROES } from './data';
import { Fx } from './fx';
import { ANIM_KEYS, lookKeys, makeHeroModel, setGrip } from './heroModel';

MeshoptCompression.Configuration = { decoder: { url: new URL('meshopt_decoder.js', document.baseURI).href } };
const q = new URLSearchParams(location.search);
const log = (s: string) => { document.getElementById('log')!.textContent += s + '\n'; console.log(s); };

for (const g of q.getAll('grip')) {
  const [name, r, p] = g.split(':');
  const rot = r.split(',').map(v => Number(v) * Math.PI / 180) as [number, number, number];
  const pos = p.split(',').map(Number) as [number, number, number];
  setGrip(name, { rot, pos });
}

const canvas = document.getElementById('c') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
scene.clearColor = new Color4(0.08, 0.08, 0.1, 1);
new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.8;
const sun = new DirectionalLight('sun', new Vector3(0.3, -1, 0.5), scene);
sun.position = new Vector3(-5, 10, -8);
sun.intensity = 1.8;
const shadow = new ShadowGenerator(1024, sun);
const ground = MeshBuilder.CreateGround('g', { width: 30, height: 10 }, scene);
const gm = new StandardMaterial('gm', scene);
gm.diffuseColor = new Color3(0.22, 0.22, 0.26);
ground.material = gm;
ground.receiveShadows = true;
const fx = new Fx(scene);

async function main() {
  const def = HEROES.find(h => h.id === (q.get('hero') ?? 'leon'))!;
  const only = q.get('i');
  const looks = only === null ? def.looks! : [def.looks![Number(only)]];
  const assets = new Assets(scene);
  const t0 = performance.now();
  await assets.ensure([...ANIM_KEYS, ...looks.flatMap(lookKeys)]);
  log(`${def.name}: 외형 ${looks.length}개, 받기 ${(performance.now() - t0).toFixed(0)}ms`);
  const gap = 1.1, w = (looks.length - 1) * gap;
  const cam = new ArcRotateCamera('cam', -Math.PI / 2 + Number(q.get('a') ?? 0), 1.38, w * 0.95 + 4, new Vector3(0, 0.95, 0), scene);
  cam.attachControl(canvas, true);
  looks.forEach((look, i) => {
    const m = makeHeroModel(assets, scene, look, shadow, fx);
    m.root.position.x = w / 2 - i * gap;   // 카메라에서 보면 +x 가 왼쪽
    m.root.rotation.y = Math.PI;           // 카메라를 본다
    const name = q.get('anim') ?? def.anims.idle;
    const g = m.anims.get(name);
    g?.start(true, 1);
    if (i === 0) {
      const bb = m.root.getHierarchyBoundingVectors(true);
      log(`높이 ${(bb.max.y - bb.min.y).toFixed(2)} 폭 ${(bb.max.x - bb.min.x).toFixed(2)}, 몸 루트 배율 ${m.meshes[0].parent?.name} ${(m.meshes[0].parent as any)?.scaling?.toString()}`);
    }
    if (i === 0) log(`anims ${m.anims.size}: ${[...m.anims.keys()].join(', ')}${g ? '' : ' (없음: ' + name + ')'}`);
  });
  log(looks.map((_, i) => `${GRADES[i]} ${def.titles![i]}`).join(' | '));
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
}
main().catch(e => log('ERR ' + (e?.stack ?? e)));
