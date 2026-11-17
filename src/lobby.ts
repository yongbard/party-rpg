// 로비: 파티가 카메라를 보고 서 있다. 아래 탭으로 [모험](스테이지 선택) / [영웅](능력치·레벨업)
import { Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import type { Assets } from './assets';
import type { CameraRig } from './camera';
import { CHAPTER, COL, GRADES, GRADE_COLORS, HEROES, MAX_LEVEL, STAGES, gradeMul, heroMul, levelCost, lookOf, power, type UnitDef } from './data';
import { lookKeys, makeHeroModel } from './heroModel';
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
  private preview: number | null = null;   // 영웅 탭에서 미리 보는 등급 (null = 지금 등급)

  constructor(private scene: Scene, private assets: Assets, private shadow: ShadowGenerator, private rig: CameraRig, private hud: Hud, private fx: Fx) {
    this.el = document.createElement('div');
    this.el.id = 'lobby';
    document.getElementById('app')!.append(this.el);
  }

  show(save: SaveData) {
    this.save = save;
    this.rig.setView('lobby', true);
    this.units = save.party.map((id, i) => this.makeUnit(HEROES.find(h => h.id === id)!, i, save.heroes[id].grade));
    // 처음 열리는 스테이지(안 깬 것 중 첫째)를 고른다
    const open = STAGES.filter((_s, i) => i === 0 || save.cleared.includes(STAGES[i - 1].id));
    this.selected = (open.find(s => !save.cleared.includes(s.id)) ?? open[open.length - 1]).id;
    this.tab = 'adventure';
    this.render();
    this.el.style.display = '';
  }

  /** 줄의 i 번째 자리에 그 등급 외형으로 영웅을 세운다 (외형 파일은 미리 받아 둬야 한다) */
  private makeUnit(def: UnitDef, i: number, grade: number) {
    const lv = this.save.heroes[def.id].level;
    const model = makeHeroModel(this.assets, this.scene, lookOf(def, grade)!, this.shadow, this.fx);
    const u = new Unit(def, 'hero', model, new Vector3(LINEUP[i], 0, 3 + Math.abs(LINEUP[i]) * 0.25), Math.PI, heroMul(lv) * gradeMul(grade));
    u.title = def.titles?.[grade];
    u.play(def.anims.idle);
    return u;
  }

  /** 영웅 탭: 다른 등급의 외형을 3D 로 바꿔 보여 준다 */
  private async showGrade(grade: number | null) {
    const i = this.heroIdx;
    const def = this.units[i].def;
    const g = grade ?? this.save.heroes[def.id].grade;
    this.preview = grade;
    await this.assets.ensure(lookKeys(lookOf(def, g)!));
    if (this.units[i]?.def !== def) return;   // 기다리는 사이 다른 영웅을 골랐다
    this.units[i].model.dispose();
    this.units[i] = this.makeUnit(def, i, g);
    this.fx.ring(this.units[i].pos, COL.gold, 1.6, 0.5);
    this.render();
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
    if (this.preview !== null) void this.showGrade(null);
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
        b.onclick = () => {
          if (this.preview !== null) void this.showGrade(null);
          this.heroIdx = Number(b.dataset.i);
          this.rig.focus(this.units[this.heroIdx]);
          this.render();
        };
      });
      this.el.querySelectorAll<HTMLButtonElement>('.rung').forEach(b => {
        b.onclick = () => {
          const g = Number(b.dataset.g);
          void this.showGrade(g === this.save.heroes[this.units[this.heroIdx].def.id].grade ? null : g);
        };
      });
      this.el.querySelectorAll<HTMLButtonElement>('.lvup').forEach(b => { b.onclick = () => this.levelUp(Number(b.dataset.n)); });
    }
  }

  private adventureHtml() {
    const s = this.save;
    const isOpen = (i: number) => i === 0 || s.cleared.includes(STAGES[i - 1].id);
    const partyPower = this.units.reduce((sum, u) => sum + power(u.def, s.heroes[u.def.id].level, s.heroes[u.def.id].grade), 0);
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
    const grade = s.heroes[d.id].grade;
    const shown = this.preview ?? grade;
    const gm = gradeMul(grade);
    const m = heroMul(lv) * gm, m2 = heroMul(lv + 1) * gm;
    const max = d.maxGrade ?? 2;
    const ladder = Array.from({ length: max + 1 }, (_, g) => `
      <button class="rung ${g === shown ? 'on' : ''} ${g === grade ? 'cur' : ''} ${g > grade ? 'future' : ''}" data-g="${g}" style="--gc:${GRADE_COLORS[g]}">
        <i>${GRADES[g]}</i><span>${d.titles?.[g] ?? ''}</span>
      </button>`).join('');
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
          <div><div class="hd-title" style="color:${GRADE_COLORS[grade]}">${GRADES[grade]} · ${d.titles?.[grade] ?? ''}</div><div class="hd-name">${d.name}<span>Lv.${lv}<small>/${MAX_LEVEL}</small></span></div></div>
          <div class="hd-power"><small>전투력</small><b>${fmt(power(d, lv, grade))}</b></div>
        </div>
        <div class="ladder">${ladder}</div>
        ${shown !== grade ? `<div class="ladder-note">${GRADES[shown]} 「${d.titles?.[shown] ?? ''}」 외형 미리보기 · ${shown > grade ? '같은 영웅 조각으로 승격하면 이 모습이 된다' : '지나온 모습'}</div>` : `<div class="ladder-note">최대 ${GRADES[max]}까지 성장 · 칭호를 누르면 그 등급 외형을 미리 본다</div>`}
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
    u.mul = heroMul(h.level) * gradeMul(h.grade);
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
