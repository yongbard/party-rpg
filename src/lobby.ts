// 로비: 파티가 카메라를 보고 서 있고, 재화와 스테이지 선택 UI 를 띄운다
import { ShadowGenerator, Vector3 } from '@babylonjs/core';
import type { Assets } from './assets';
import { makeModel } from './battle';
import type { CameraRig } from './camera';
import { CHAPTER, HEROES, STAGES, heroMul } from './data';
import type { Hud } from './hud';
import type { SaveData } from './save';
import { Unit } from './unit';

// 카메라에서 보면 +x 가 왼쪽이다 (오른손 좌표계, 카메라가 +z 를 본다)
const LINEUP = [2.4, 0.8, -0.8, -2.4];

export class Lobby {
  onStart: (stageId: string) => void = () => {};
  units: Unit[] = [];
  private el: HTMLElement;
  private plates: HTMLElement[] = [];
  private selected = STAGES[0].id;

  constructor(private assets: Assets, private shadow: ShadowGenerator, private rig: CameraRig, private hud: Hud) {
    this.el = document.createElement('div');
    this.el.id = 'lobby';
    document.getElementById('app')!.append(this.el);
  }

  show(save: SaveData) {
    this.rig.setView('lobby');
    this.units = save.party.map((id, i) => {
      const def = HEROES.find(h => h.id === id)!;
      const u = new Unit(def, 'hero', makeModel(this.assets, def, this.shadow), new Vector3(LINEUP[i], 0, 3 + Math.abs(LINEUP[i]) * 0.25), Math.PI, heroMul(save.heroes[id].level));
      u.play(def.anims.idle);
      return u;
    });
    // 처음 열리는 스테이지(안 깬 것 중 첫째)를 고른다
    const open = STAGES.filter((_s, i) => i === 0 || save.cleared.includes(STAGES[i - 1].id));
    this.selected = (open.find(s => !save.cleared.includes(s.id)) ?? open[open.length - 1]).id;
    this.render(save);
    this.el.style.display = '';
  }

  hide() {
    this.units.forEach(u => u.model.dispose());
    this.units = [];
    this.plates = [];
    this.el.style.display = 'none';
  }

  /** 이름표를 캐릭터 발밑에 붙인다 */
  update() {
    this.units.forEach((u, i) => {
      const p = this.hud.project(u.pos);
      const el = this.plates[i];
      if (el) el.style.transform = `translate(${p.x}px, ${p.y + 6}px)`;
    });
  }

  private render(save: SaveData) {
    const isOpen = (i: number) => i === 0 || save.cleared.includes(STAGES[i - 1].id);
    this.el.innerHTML = `
      <div class="lb-top">
        <div class="res"><i class="ic-gold"></i><b>${save.gold.toLocaleString()}</b></div>
        <div class="res"><i class="ic-gem"></i><b>${save.gems.toLocaleString()}</b></div>
      </div>
      <div class="lb-plates">${this.units.map(u => `
        <div class="plate" style="--accent:${u.def.color}"><b>${u.def.name}</b><span>Lv.${save.heroes[u.def.id].level}</span></div>`).join('')}
      </div>
      <div class="lb-panel">
        <div class="lb-ch">${CHAPTER}</div>
        <div class="lb-stages">${STAGES.map((s, i) => {
          const cleared = save.cleared.includes(s.id);
          return `
          <button class="stage ${s.id === this.selected ? 'sel' : ''} ${isOpen(i) ? '' : 'locked'} ${s.waves.some(w => w.boss) ? 'is-boss' : ''}" data-id="${s.id}" ${isOpen(i) ? '' : 'disabled'}>
            <span class="sid">${s.id}</span>
            <span class="snm">${s.name}${cleared ? '<i class="ok">클리어</i>' : ''}</span>
            <span class="srw"><i class="ic-gold"></i>${s.reward.gold}${cleared ? '' : `<i class="ic-gem"></i>${s.reward.gems}`}</span>
          </button>`;
        }).join('')}
        </div>
        <button class="lb-go">출전</button>
      </div>`;
    this.plates = [...this.el.querySelectorAll<HTMLElement>('.plate')];
    this.el.querySelectorAll<HTMLButtonElement>('.stage').forEach(b => {
      b.onclick = () => { this.selected = b.dataset.id!; this.render(save); };
    });
    this.el.querySelector<HTMLButtonElement>('.lb-go')!.onclick = () => this.onStart(this.selected);
  }
}
