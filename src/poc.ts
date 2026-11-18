// 외형 확인 페이지: 영웅 한 명의 등급별 외형을 한 줄로 세운다
// 주소: /poc.html?hero=leon&anim=Sword_Block  (anim 생략 시 영웅 대기 동작)
//       몸만 바꿔 보기: &body=q/body/TripoDragon (그 영웅 동작으로)
//       적 줄 세우기: /poc.html?enemy=zombie,cultist,goblin  (ENEMIES 의 조합형 적)
//       몬스터 비교: &mon=Demon,Yeti:2.4  (public/poc/um/{이름}.glb 를 영웅 옆에 높이 2.4 로 세운다)
//       무기 각도 맞춤: &grip=blade:0,0,90:0.03,0.09,0.02[:배율]  (도, m)  장비 시험: &helmet=Knight_Helmet&cloak=Knight_Cape
//       외형 규칙 검사: &check (앞 등급과 모양이 같은 등급을 적는다)
//       장식 시험: &acc=q/acc/Crown,fx:halo  맞춤: &fit=Crown:Head:0.2:0,0.2,0:0,0,0  (뼈:크기 m:위치 m:회전 도)  뼈 이름 보기: &bones
import { ArcRotateCamera, LoadAssetContainerAsync, TransformNode, Color3, Color4, DirectionalLight, Engine, HemisphericLight, MeshBuilder, MeshoptCompression, Scene, ShadowGenerator, StandardMaterial, Vector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { Assets } from './assets';
import { colorOnlyGrades, ENEMIES, GRADES, HEROES } from './data';
import { Fx } from './fx';
import { ANIM_KEYS, lookKeys, makeHeroModel, setAccFit, setGrip } from './heroModel';

MeshoptCompression.Configuration = { decoder: { url: new URL('meshopt_decoder.js', document.baseURI).href } };
const q = new URLSearchParams(location.search);
const log = (s: string) => { document.getElementById('log')!.textContent += s + '\n'; console.log(s); };

for (const g of q.getAll('grip')) {
  const [name, r, p, sc] = g.split(':');
  const rot = r.split(',').map(v => Number(v) * Math.PI / 180) as [number, number, number];
  const pos = p.split(',').map(Number) as [number, number, number];
  setGrip(name, { rot, pos, scale: sc ? Number(sc) : undefined });
}

for (const f of q.getAll('fit')) {
  const [name, bone, size, p, r] = f.split(':');
  setAccFit(name, { bone, size: Number(size), pos: p.split(',').map(Number) as [number, number, number], rot: r.split(',').map(v => Number(v) * Math.PI / 180) as [number, number, number] });
}
const extraAcc = q.get('acc')?.split(',') ?? [];

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
  if (q.has('check')) { const bad = colorOnlyGrades(); log(`색·빛만 바뀌는 등급 ${bad.length}개${bad.length ? ': ' + bad.join(', ') : ''}`); }
  const foes = q.get('enemy')?.split(',').map(id => ENEMIES[id]);
  const def = HEROES.find(h => h.id === (q.get('hero') ?? 'leon'))!;
  const only = q.get('i');
  const body = q.get('body');
  const looks = foes ? foes.map(e => e.looks![0]) : body ? [{ body }] : only === null ? def.looks! : [def.looks![Number(only)]];
  const assets = new Assets(scene);
  const t0 = performance.now();
  await assets.ensure([...ANIM_KEYS, ...looks.flatMap(lookKeys), ...['helmet', 'cloak'].filter(k => q.get(k)).map(k => `q/gear/${q.get(k)}`), ...extraAcc.filter(k => !k.startsWith('fx:'))]);
  log(`${def.name}: 외형 ${looks.length}개, 받기 ${(performance.now() - t0).toFixed(0)}ms`);
  const gap = 1.1, w = (looks.length - 1) * gap;
  const cam = new ArcRotateCamera('cam', -Math.PI / 2 + Number(q.get('a') ?? 0), 1.38, Number(q.get('r') ?? w * 0.95 + 4), new Vector3(0, Number(q.get('ty') ?? 0.95), 0), scene);   // &r= 거리, &ty= 볼 높이
  cam.attachControl(canvas, true);
  looks.forEach((look, i) => {
    const gear = { helmet: q.get('helmet') ? `q/gear/${q.get('helmet')}` : look.helmet, cloak: q.get('cloak') ? `q/gear/${q.get('cloak')}` : look.cloak };
    const m = makeHeroModel(assets, scene, { ...look, ...gear, acc: [...(look.acc ?? []), ...extraAcc] }, shadow, fx);
    if (i === 0 && q.has('bones')) log('bones: ' + m.root.getDescendants(false).filter(d => !(d as any).getTotalVertices).map(d => d.name).join(' '));
    m.root.position.x = w / 2 - i * gap;   // 카메라에서 보면 +x 가 왼쪽
    m.root.rotation.y = Math.PI;           // 카메라를 본다
    const name = q.get('anim') ?? (foes ? foes[i] : def).anims.idle;
    const g = m.anims.get(name);
    g?.start(true, 1);
    if (i === 0) {
      const bb = m.root.getHierarchyBoundingVectors(true);
      log(`높이 ${(bb.max.y - bb.min.y).toFixed(2)} 폭 ${(bb.max.x - bb.min.x).toFixed(2)}, 몸 루트 배율 ${m.meshes[0].parent?.name} ${(m.meshes[0].parent as any)?.scaling?.toString()}`);
    }
    if (i === 0) log(`anims ${m.anims.size}: ${[...m.anims.keys()].join(', ')}${g ? '' : ' (없음: ' + name + ')'}`);
  });
  const [mons, mh] = (q.get('mon') ?? '').split(':');
  for (const [k, name] of mons.split(',').filter(Boolean).entries()) {
    const c = await LoadAssetContainerAsync(`poc/um/${name}.glb`, scene);
    const e = c.instantiateModelsToScene(n => n, false, { doNotInstantiate: true });
    const holder = new TransformNode(name, scene);
    e.rootNodes.forEach(r => (r.parent = holder));
    holder.computeWorldMatrix(true);
    const bb = holder.getHierarchyBoundingVectors(true);
    const h0 = bb.max.y - bb.min.y, s = Number(mh ?? 2.2) / h0;
    holder.scaling.setAll(s);
    holder.position.x = -w / 2 - 1.6 - k * 2.2;
    holder.rotation.y = Math.PI;
    holder.getChildMeshes().forEach(m => shadow.addShadowCaster(m));
    e.animationGroups.forEach(g => g.stop());
    const idle = e.animationGroups.find(g => /Idle/.test(g.name)) ?? e.animationGroups[0];
    idle?.start(true, 1);
    log(`${name}: 원래 높이 ${h0.toFixed(3)} → 배율 ${s.toFixed(1)}, anims ${e.animationGroups.map(g => g.name.split('|').pop()).join(' ')}`);
  }
  if (mons) { const n = mons.split(',').length; cam.target.x = -n * 1.1 - 0.8; cam.radius += n * 2.2; }
  log(foes ? foes.map(e => e.name).join(' | ') : looks.map((_, i) => `${GRADES[i]} ${def.titles![i]}`).join(' | '));
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
}
main().catch(e => log('ERR ' + (e?.stack ?? e)));
