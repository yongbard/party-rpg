import { AbstractEngine, Engine, MeshoptCompression, Scene, WebGPUEngine } from '@babylonjs/core';
import { buildArena, setupPost } from './arena';
import { Assets, type AssetEntry } from './assets';
import { Battle } from './battle';
import { CameraRig } from './camera';
import { animsByModel, HEROES, heroMul, STAGES } from './data';
import { Fx } from './fx';
import { Hud } from './hud';
import { Lobby } from './lobby';
import { loadSave, writeSave } from './save';
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

const ASSETS: AssetEntry[] = (() => {
  const anims = animsByModel();
  const chars = ['Knight', 'Barbarian', 'Mage', 'Rogue_Hooded'].map(k => ({ key: k, url: `assets/characters/${k}.glb`, keepAnims: anims.get(k) }));
  const enemies = ['Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Rogue', 'Skeleton_Mage'].map(k => ({ key: k, url: `assets/enemies/${k}.glb`, keepAnims: anims.get(k) }));
  const weapons = ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Crossbow', 'Skeleton_Staff', 'Skeleton_Shield_Small_A', 'Skeleton_Shield_Large_A']
    .map(k => ({ key: k, url: `assets/enemies/weapons/${k}.glb` }));
  return [...chars, ...enemies, ...weapons];
})();

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
  await assets.load(ASSETS, p => hud.loading(0.05 + p * 0.85, '모험가를 부르는 중'));
  const arena = await arenaP;
  setupPost(scene, [rig.main, rig.cut], mobile);

  const save = loadSave();
  const lobby = new Lobby(assets, arena.shadow, rig, hud, fx);
  lobby.show(save);

  // 초상화: 로비에 선 영웅 얼굴을 정면에서 한 명씩 찍는다
  hud.loading(0.95, '초상화를 그리는 중');
  rig.portrait(lobby.units[0]);
  await scene.whenReadyAsync();
  const portraits: Record<string, string> = {};
  for (const h of lobby.units) {
    lobby.units.forEach(o => o.root.setEnabled(o === h));
    rig.portrait(h);
    scene.render();
    scene.render();
    portraits[h.def.id] = grabSquare(canvas);
  }
  lobby.units.forEach(o => o.root.setEnabled(true));
  lobby.portraits = portraits;
  rig.setView('lobby', true);

  let battle: Battle | null = null;
  let speed = 1;
  hud.visible(false);

  const startBattle = (stageId: string) => {
    const stage = STAGES.find(s => s.id === stageId)!;
    lobby.hide();
    rig.setView('battle', true);
    const party = save.party.map(id => ({ def: HEROES.find(h => h.id === id)!, mul: heroMul(save.heroes[id].level) }));
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
      let reward: { gold: number; gems: number } | null = null;
      if (win) {
        const first = !save.cleared.includes(stage.id);
        reward = { gold: stage.reward.gold, gems: first ? stage.reward.gems : 0 };
        save.gold += reward.gold;
        save.gems += reward.gems;
        if (first) save.cleared.push(stage.id);
        writeSave(save);
      }
      hud.result(win, b.heroes, b.time, reward, () => { endBattle(); startBattle(stage.id); }, () => { endBattle(); lobby.show(save); });
    };
    b.start();
    (window as unknown as { battle: Battle }).battle = b;
  };
  const endBattle = () => {
    battle?.dispose();
    battle = null;
    hud.visible(false);
  };
  lobby.onStart = startBattle;

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
