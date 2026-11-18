import { AbstractEngine, Engine, MeshoptCompression, Scene, WebGPUEngine } from '@babylonjs/core';
import { buildArena, setupPost } from './arena';
import { Assets } from './assets';
import { Battle } from './battle';
import { CameraRig } from './camera';
import { condMet, condText, repeatGems, stageEnemies, STAGES, starGems } from './data';
import { rollGrade, rollItem, type Item } from './items';
import { loadout } from './loadout';
import { ANIM_KEYS, lookKeys } from './heroModel';
import { Fx } from './fx';
import { Hud } from './hud';
import { Lobby } from './lobby';
import { track } from './missions';
import { addItem, loadSave, writeSave } from './save';

// 스테이지 적 레벨별 드랍 등급 확률 (일반 ~ 초월). 레벨 이하에서 가장 높은 줄을 쓴다
const DROP_WEIGHTS: [number, number[]][] = [
  [1, [60, 30, 9, 1, 0, 0, 0, 0]],
  [2, [45, 35, 15, 4, 1, 0, 0, 0]],
  [4, [25, 35, 25, 11, 3.5, 0.5, 0, 0]],
  [8, [15, 30, 30, 18, 6, 1, 0, 0]],
  [12, [10, 25, 32, 22, 9, 2, 0, 0]],
  [16, [5, 20, 32, 27, 12, 3.5, 0.5, 0]],
];
const dropWeights = (lv: number) => DROP_WEIGHTS.filter(([l]) => l <= lv).pop()![1];
import './style.css';

const params = new URLSearchParams(location.search);
const mobile = matchMedia('(pointer: coarse)').matches;

// 모델은 meshopt 로 압축돼 있다 (npm run assets). 디코더는 CDN 대신 우리 사이트에서 받는다
MeshoptCompression.Configuration = { decoder: { url: new URL('meshopt_decoder.js', document.baseURI).href } };

async function createEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine> {
  // 기본은 WebGL2. ?gpu=webgpu 로 WebGPU 를 시험한다
  if (params.get('gpu') === 'webgpu' && (await WebGPUEngine.IsSupportedAsync)) {
    try {
      const e = new WebGPUEngine(canvas, { antialias: true, stencil: true });
      await e.initAsync();
      return e;
    } catch (err) {
      console.warn('WebGPU 실패, WebGL2 로 전환', err);
    }
  }
  return new Engine(canvas, false, { stencil: true, powerPreference: 'high-performance' }, false);
}

/** 지금 캔버스를 정사각형으로 잘라 이미지로 만든다 (render 직후 같은 작업 안에서 불러야 한다) */
function grabSquare(canvas: HTMLCanvasElement, size = 192) {
  const w = canvas.width, h = canvas.height, s = Math.min(w, h);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d')!.drawImage(canvas, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/webp', 0.9);
}

async function main() {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const engine = await createEngine(canvas);
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;

  const rig = new CameraRig(scene);
  const hud = new Hud(engine, scene, canvas);
  const fx = new Fx(scene);
  const assets = new Assets(scene);

  hud.loading(0.02, '던전을 짓는 중');
  const arenaP = buildArena(scene, fx, mobile);
  const arena = await arenaP;
  setupPost(scene, [rig.main, rig.cut], mobile);

  const save = loadSave();
  // 조합형 영웅: 공용 애니메이션 + 파티의 지금 등급 외형 파츠
  hud.loading(0.5, '영웅을 조립하는 중');
  await assets.ensure([...ANIM_KEYS, ...save.party.flatMap(id => lookKeys(loadout(save, id).look))]);
  const lobby = new Lobby(scene, assets, arena.shadow, rig, hud, fx);
  lobby.show(save);

  // 초상화: 로비에 선 영웅 얼굴을 정면에서 한 명씩 찍는다
  hud.loading(0.95, '초상화를 그리는 중');
  rig.portrait(lobby.units[0]);
  await scene.whenReadyAsync();
  const portraits: Record<string, string> = {};
  // 한 명만 남기고 숨긴 채 찍는다 (다른 영웅이 카메라 앞을 가리지 않게). 승격으로 외형이 바뀌면 로비가 다시 부른다
  const snap = (ids: string[]) => {
    for (const h of lobby.shown().filter(u => ids.includes(u.def.id))) {
      lobby.shown().forEach(o => o.root.setEnabled(o === h));
      rig.portrait(h);
      // 막 세운 영웅은 기본 자세(T자)에서 대기 동작으로 섞여 들어가는 중이다. 섞임이 끝나게 몇 장 더 그린다 (blendingSpeed 0.12 → 약 9장)
      for (let k = 0; k < 10; k++) scene.render();
      portraits[h.def.id] = grabSquare(canvas);
    }
    lobby.shown().forEach(o => o.root.setEnabled(true));
  };
  snap(lobby.units.map(u => u.def.id));
  lobby.portraits = portraits;
  lobby.snap = snap;
  rig.setView('lobby', true);

  let battle: Battle | null = null;
  let speed = 1;
  hud.visible(false);

  const startBattle = async (stageId: string) => {
    const stage = STAGES.find(s => s.id === stageId)!;
    const party = save.party.map(id => loadout(save, id));
    // 적은 조합형이면 외형 파츠를, 통짜 모델(um/)이면 그 파일을 받는다
    const foes = stageEnemies(stage).flatMap(d => (d.looks ? lookKeys(d.looks[0]) : [d.model]));
    await assets.ensure([...party.flatMap(p => lookKeys(p.look)), ...foes]);
    lobby.hide();
    rig.setView('battle', true);
    const b = new Battle(scene, assets, fx, rig, hud, arena.shadow, stage, party);
    battle = b;
    b.spawnHeroes();
    hud.setHeroes(b.heroes, b.heroes.map(h => portraits[h.def.id]));
    hud.visible(true);
    b.setSpeed(speed);
    hud.setSpeed(speed);
    b.auto = !!save.auto;
    hud.setAuto(b.auto);
    b.onEnd = win => {
      let reward: { gold: number; gems: number; items: Item[]; first: boolean; stars: { text: string; met: boolean; was: boolean }[] } | null = null;
      if (win) {
        const first = !save.cleared.includes(stage.id);
        // 별: 이번에 처음 채운 조건마다 보석. 새 별이 없으면 다시 깬 보석
        const o = b.outcome(true);
        const had = save.stars![stage.id] ?? 0;
        const now = stage.conds.reduce((bits, c, i) => bits | (condMet(c, o) ? 1 << i : 0), 0);
        const fresh = now & ~had;
        const nNew = [0, 1, 2].filter(i => fresh & (1 << i)).length;
        reward = {
          gold: stage.reward.gold, gems: nNew ? nNew * starGems(stage) : repeatGems(stage), items: [], first,
          stars: stage.conds.map((c, i) => ({ text: condText(c), met: !!(now & (1 << i)), was: !!(had & (1 << i)) })),
        };
        save.stars![stage.id] = had | now;
        save.gold += reward.gold;
        save.gems += reward.gems;
        // 장비 드랍: 첫 클리어는 1개 확정, 다시 깨면 50% (장비 소환과 함께 장비를 얻는 길)
        if (first || Math.random() < 0.5) {
          const it = rollItem(0, rollGrade(dropWeights(stage.level)));
          reward.items.push(addItem(save, it));
        }
        if (first) save.cleared.push(stage.id);
        track(save, 'win');
        if (stage.waves.some(w => w.boss)) track(save, 'boss');
        if (nNew) track(save, 'star', nNew);
        writeSave(save);
      }
      hud.result(win, b.heroes, b.time, reward, () => { endBattle(); void startBattle(stage.id); }, () => { endBattle(); lobby.show(save); });
    };
    b.start();
    (window as unknown as { battle: Battle }).battle = b;
  };
  const endBattle = () => {
    battle?.dispose();
    battle = null;
    hud.visible(false);
  };
  lobby.onStart = id => void startBattle(id);

  hud.onUlt = i => battle?.requestUlt(i);
  hud.onSpeed = () => {
    if (!battle) return;
    speed = speed >= 3 ? 1 : speed + 1;
    battle.setSpeed(speed);
    hud.setSpeed(speed);
  };
  hud.onPause = () => { if (battle) hud.setPaused(battle.togglePause()); };
  hud.onAuto = () => {
    save.auto = !save.auto;
    writeSave(save);
    hud.setAuto(save.auto);
    if (battle) battle.auto = save.auto;
  };
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    battle?.tapAt(e.clientX - r.left, e.clientY - r.top);
  });
  // 모바일은 주소창이 접히고 펴질 때 window resize 없이 캔버스 크기만 바뀌기도 한다. 캔버스 크기를 직접 지켜본다
  new ResizeObserver(() => engine.resize()).observe(canvas);

  let fpsEl: HTMLElement | null = null;
  if (params.has('fps')) { fpsEl = document.createElement('div'); fpsEl.className = 'fps'; document.body.append(fpsEl); }

  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000;
    rig.update(dt);
    arena.update(dt);
    battle?.update(dt);
    if (!battle) { lobby.update(); fx.update(dt); }
    scene.render();
    if (fpsEl) fpsEl.textContent = `${engine.getFps().toFixed(0)} fps · ${engine.name}`;
  });
  hud.hideLoading();
  (window as unknown as { game: unknown }).game = { save, lobby, startBattle };
}

main().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="err">${String(err?.stack ?? err)}</pre>`);
});
