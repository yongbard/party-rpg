// 로비: 파티가 카메라를 보고 서 있다. 아래 탭으로 [모험](스테이지 선택) / [영웅](능력치·레벨업)
import { ShadowGenerator, Vector3 } from '@babylonjs/core';
import type { Assets } from './assets';
import { makeModel } from './battle';
import type { CameraRig } from './camera';
import { CHAPTER, COL, HEROES, MAX_LEVEL, STAGES, heroMul, levelCost, power, type UnitDef } from './data';
import type { Fx } from './fx';
import type { Hud } from './hud';
import { writeSave, type SaveData } from './save';
import { Unit } from './unit';

// 카메라에서 보면 +x 가 왼쪽이다 (오른손 좌표계, 카메라가 +z 를 본다)
const LINEUP = [2.4, 0.8, -0.8, -2.4];

type Tab = 'adventure' | 'hero';
const fmt = (n: number) => Math.round(n).toLocaleString();

export class Lobby {
  onStart: (stageId: string) => void = () => {};
  units: Unit[] = [];
  portraits: Record<string, string> = {};
  private el: HTMLElement;
  private plates: HTMLElement[] = [];
  private selected = STAGES[0].id;
  private tab: Tab = 'adventure';
  private heroIdx = 0;
  private save!: SaveData;

  constructor(private assets: Assets, private shadow: ShadowGenerator, private rig: CameraRig, private hud: Hud, private fx: Fx) {
    this.el = document.createElement('div');
    this.el.id = 'lobby';
    document.getElementById('app')!.append(this.el);
  }

  show(save: SaveData) {
    this.save = save;
    this.rig.setView('lobby', true);
    this.units = save.party.map((id, i) => {
      const def = HEROES.find(h => h.id === id)!;
      const u = new Unit(def, 'hero', makeModel(this.assets, def, this.shadow), new Vector3(LINEUP[i], 0, 3 + Math.abs(LINEUP[i]) * 0.25), Math.PI, heroMul(save.heroes[id].level));
      u.play(def.anims.idle);
      return u;
    });
    // 처음 열리는 스테이지(안 깬 것 중 첫째)를 고른다
    const open = STAGES.filter((_s, i) => i === 0 || save.cleared.includes(STAGES[i - 1].id));
    this.selected = (open.find(s => !save.cleared.includes(s.id)) ?? open[open.length - 1]).id;
    this.tab = 'adventure';
    this.render();
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

  private setTab(t: Tab) {
    this.tab = t;
    if (t === 'hero') this.rig.focus(this.units[this.heroIdx]);
    else this.rig.setView('lobby');
    this.render();
  }

  private render() {
    const s = this.save;
    this.el.innerHTML = `
      <div class="lb-top">
        <div class="res"><i class="ic-gold"></i><b>${fmt(s.gold)}</b></div>
        <div class="res"><i class="ic-gem"></i><b>${fmt(s.gems)}</b></div>
      </div>
      <div class="lb-plates ${this.tab === 'hero' ? 'hide' : ''}">${this.units.map(u => `
        <div class="plate" style="--accent:${u.def.color}"><b>${u.def.name}</b><span>Lv.${s.heroes[u.def.id].level}</span></div>`).join('')}
      </div>
      <div class="lb-bottom">
        ${this.tab === 'adventure' ? this.adventureHtml() : this.heroHtml()}
        <div class="lb-tabs">
          <button data-tab="adventure" class="${this.tab === 'adventure' ? 'on' : ''}">모험</button>
          <button data-tab="hero" class="${this.tab === 'hero' ? 'on' : ''}">영웅</button>
        </div>
      </div>`;
    this.plates = [...this.el.querySelectorAll<HTMLElement>('.plate')];
    this.el.querySelectorAll<HTMLButtonElement>('.lb-tabs button').forEach(b => { b.onclick = () => this.setTab(b.dataset.tab as Tab); });
    if (this.tab === 'adventure') {
      this.el.querySelectorAll<HTMLButtonElement>('.stage').forEach(b => { b.onclick = () => { this.selected = b.dataset.id!; this.render(); }; });
      this.el.querySelector<HTMLButtonElement>('.lb-go')!.onclick = () => this.onStart(this.selected);
    } else {
      this.el.querySelectorAll<HTMLButtonElement>('.chip').forEach(b => {
        b.onclick = () => { this.heroIdx = Number(b.dataset.i); this.rig.focus(this.units[this.heroIdx]); this.render(); };
      });
      this.el.querySelectorAll<HTMLButtonElement>('.lvup').forEach(b => { b.onclick = () => this.levelUp(Number(b.dataset.n)); });
    }
  }

  private adventureHtml() {
    const s = this.save;
    const isOpen = (i: number) => i === 0 || s.cleared.includes(STAGES[i - 1].id);
    const partyPower = this.units.reduce((sum, u) => sum + power(u.def, s.heroes[u.def.id].level), 0);
    return `
      <div class="lb-panel">
        <div class="lb-ch">${CHAPTER}<span class="pp">파티 전투력 <b>${fmt(partyPower)}</b></span></div>
        <div class="lb-stages">${STAGES.map((st, i) => {
          const cleared = s.cleared.includes(st.id);
          return `
          <button class="stage ${st.id === this.selected ? 'sel' : ''} ${isOpen(i) ? '' : 'locked'} ${st.waves.some(w => w.boss) ? 'is-boss' : ''}" data-id="${st.id}" ${isOpen(i) ? '' : 'disabled'}>
            <span class="sid">${st.id}</span>
            <span class="snm">${st.name}<em>적 Lv.${st.level}</em>${cleared ? '<i class="ok">클리어</i>' : ''}</span>
            <span class="srw"><i class="ic-gold"></i>${st.reward.gold}${cleared ? '' : `<i class="ic-gem"></i>${st.reward.gems}`}</span>
          </button>`;
        }).join('')}
        </div>
        <button class="lb-go">출전</button>
      </div>`;
  }

  private heroHtml() {
    const s = this.save;
    const u = this.units[this.heroIdx];
    const d: UnitDef = u.def;
    const lv = s.heroes[d.id].level;
    const m = heroMul(lv), m2 = heroMul(lv + 1);
    const st = d.stats;
    const grow = (base: number) => (lv < MAX_LEVEL ? `<em>+${fmt(base * m2 - base * m)}</em>` : '');
    const costOf = (n: number) => { let c = 0; for (let i = 0; i < n; i++) c += levelCost(lv + i); return c; };
    const btn = (n: number) => {
      const left = MAX_LEVEL - lv;
      const c = costOf(Math.min(n, left));
      return `<button class="lvup" data-n="${n}" ${left > 0 && s.gold >= c ? '' : 'disabled'}><b>Lv +${n}</b><span><i class="ic-gold"></i>${left > 0 ? fmt(c) : '최대'}</span></button>`;
    };
    const skills = d.skills.map(k => `<li><b>${k.name}</b><small>재사용 ${k.cd}초</small><p>${k.desc ?? ''}</p></li>`).join('');
    return `
      <div class="lb-panel hero" style="--accent:${d.color}">
        <div class="chips">${this.units.map((x, i) => `
          <button class="chip ${i === this.heroIdx ? 'on' : ''}" data-i="${i}" style="--accent:${x.def.color}"><img src="${this.portraits[x.def.id] ?? ''}" alt=""><span>Lv.${s.heroes[x.def.id].level}</span></button>`).join('')}
        </div>
        <div class="hd-head">
          <div><div class="hd-title">${d.title ?? ''}</div><div class="hd-name">${d.name}<span>Lv.${lv}<small>/${MAX_LEVEL}</small></span></div></div>
          <div class="hd-power"><small>전투력</small><b>${fmt(power(d, lv))}</b></div>
        </div>
        <div class="hd-stats">
          <div><small>체력</small><b>${fmt(st.hp * m)}</b>${grow(st.hp)}</div>
          <div><small>공격력</small><b>${fmt(st.atk * m)}</b>${grow(st.atk)}</div>
          <div><small>방어력</small><b>${fmt(st.def * m)}</b>${grow(st.def)}</div>
          <div><small>공격 속도</small><b>${st.spd}</b></div>
          <div><small>치명타</small><b>${Math.round(st.crit * 100)}%</b></div>
          <div><small>치명 피해</small><b>${Math.round(st.critDmg * 100)}%</b></div>
        </div>
        <ul class="hd-skills">
          ${d.ult ? `<li class="ult"><b>${d.ult.name}</b><small>필살기</small><p>${d.ult.desc}</p></li>` : ''}${skills}
        </ul>
        <div class="hd-lv">${btn(1)}${btn(5)}</div>
      </div>`;
  }

  private levelUp(n: number) {
    const s = this.save;
    const u = this.units[this.heroIdx];
    const h = s.heroes[u.def.id];
    let done = 0;
    while (done < n && h.level < MAX_LEVEL && s.gold >= levelCost(h.level)) {
      s.gold -= levelCost(h.level);
      h.level++;
      done++;
    }
    if (!done) return;
    writeSave(s);
    u.mul = heroMul(h.level);
    // 연출: 환호, 금빛 링과 불꽃, 레벨 표시
    u.play(u.def.anims.victory ?? u.def.anims.idle, false);
    u.curAnim?.onAnimationGroupEndObservable.addOnce(() => u.play(u.def.anims.idle));
    this.fx.ring(u.pos, COL.gold, 2.2, 0.6);
    this.fx.burst(u.chest(), COL.gold, 30, 5, 0.25);
    this.render();
    const pop = document.createElement('div');
    pop.className = 'lvpop';
    pop.textContent = `LEVEL UP  Lv.${h.level}`;
    pop.addEventListener('animationend', () => pop.remove());
    this.el.append(pop);
  }
}
