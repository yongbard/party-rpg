// 화면 위 UI (DOM): 상단 바, 영웅 카드, 머리 위 HP, 피해 숫자, 컷인, 결과
import { AbstractEngine, Matrix, Scene, Vector3 } from '@babylonjs/core';
import type { Battle } from './battle';
import type { Unit } from './unit';
import { GRADES, GRADE_COLORS } from './data';
import { baseOf, ITEM_ICON, type Item } from './items';

const el = (tag: string, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class Hud {
  onUlt: (i: number) => void = () => {};
  onSpeed: () => void = () => {};
  onPause: () => void = () => {};
  onAuto: () => void = () => {};
  private root: HTMLElement;
  private world: HTMLElement;
  private cards: { box: HTMLElement; hp: HTMLElement; sh: HTMLElement; g: HTMLElement; hpTxt: HTMLElement }[] = [];
  private bars = new Map<Unit, { box: HTMLElement; fill: HTMLElement; sh: HTMLElement }>();
  private waveEl: HTMLElement;
  private bossEl: HTMLElement;
  private speedBtn: HTMLButtonElement;
  private pauseBtn: HTMLButtonElement;
  private autoBtn: HTMLButtonElement;
  private hintEl: HTMLElement;
  private bannerEl: HTMLElement;
  private cutEl: HTMLElement;
  private flashEl: HTMLElement;
  private loadEl: HTMLElement;
  private resultEl: HTMLElement;
  private heroes: Unit[] = [];

  constructor(private engine: AbstractEngine, private scene: Scene, private canvas: HTMLCanvasElement) {
    this.root = document.getElementById('hud')!;
    this.world = el('div', 'world');
    const top = el('div', 'top');
    this.waveEl = el('div', 'wave');
    const btns = el('div', 'btns');
    this.speedBtn = el('button', 'btn', '1×') as HTMLButtonElement;
    this.pauseBtn = el('button', 'btn', '❚❚') as HTMLButtonElement;
    this.speedBtn.onclick = () => this.onSpeed();
    this.pauseBtn.onclick = () => this.onPause();
    this.autoBtn = el('button', 'btn auto', 'AUTO') as HTMLButtonElement;
    this.autoBtn.onclick = () => this.onAuto();
    btns.append(this.autoBtn, this.speedBtn, this.pauseBtn);
    this.bossEl = el('div', 'boss hide', '<div class="bn"></div><div class="bb"><i class="lag"></i><i class="fill"></i></div>');
    top.append(this.waveEl, btns);
    this.hintEl = el('div', 'hint hide', '대상으로 삼을 적을 탭하세요');
    this.bannerEl = el('div', 'banner');
    this.cutEl = el('div', 'cutin');
    this.flashEl = el('div', 'flash');
    this.loadEl = el('div', 'loading', '<div class="lt">파티 RPG</div><div class="lb"><i></i></div><div class="ls">불러오는 중</div>');
    this.resultEl = el('div', 'result hide');
    const cardRow = el('div', 'cards');
    this.root.append(this.world, top, this.bossEl, this.hintEl, this.bannerEl, this.cutEl, this.flashEl, cardRow, this.resultEl, this.loadEl);
    for (let i = 0; i < 4; i++) {
      const box = el('div', 'card', `
        <div class="por"><img alt=""><div class="ready">필살</div><div class="nm"></div></div>
        <div class="hpb"><i class="fill"></i><i class="sh"></i><span></span></div>
        <div class="gb"><i></i></div>`);
      box.onpointerdown = e => { e.stopPropagation(); this.onUlt(i); };
      cardRow.append(box);
      this.cards.push({
        box,
        hp: box.querySelector('.hpb .fill')!,
        sh: box.querySelector('.hpb .sh')!,
        g: box.querySelector('.gb i')!,
        hpTxt: box.querySelector('.hpb span')!,
      });
    }
  }

  loading(p: number, msg?: string) {
    (this.loadEl.querySelector('.lb i') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
    if (msg) this.loadEl.querySelector('.ls')!.textContent = msg;
  }
  hideLoading() { this.loadEl.classList.add('gone'); setTimeout(() => this.loadEl.remove(), 700); }

  visible(on: boolean) { this.root.style.display = on ? '' : 'none'; }

  /** 전투를 나갈 때: 머리 위 바, 숫자, 배너, 결과를 지운다 */
  reset() {
    this.bars.clear();
    this.world.innerHTML = '';
    this.bannerEl.className = 'banner';
    this.resultEl.classList.add('hide');
    this.hint(false);
    this.setPaused(false);
    this.heroes = [];
  }

  setHeroes(heroes: Unit[], portraits: string[]) {
    this.heroes = heroes;
    heroes.forEach((h, i) => {
      const c = this.cards[i];
      c.box.style.setProperty('--accent', h.def.color);
      (c.box.querySelector('img') as HTMLImageElement).src = portraits[i];
      c.box.querySelector('.nm')!.innerHTML = `<b>${h.def.name}</b>`;
    });
  }

  setAuto(on: boolean) { this.autoBtn.classList.toggle('on', on); }
  setSpeed(s: number) { this.speedBtn.textContent = `${s}×`; }
  setPaused(p: boolean) { this.pauseBtn.textContent = p ? '▶' : '❚❚'; this.root.classList.toggle('paused', p); }

  /** 월드 좌표 → CSS 픽셀 */
  project(v: Vector3) {
    const cam = this.scene.activeCamera!;
    const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
    const p = Vector3.Project(v, Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), cam.viewport.toGlobal(w, h));
    const s = this.canvas.clientWidth / w;
    return { x: p.x * s, y: p.y * s, ok: p.z > 0 && p.z < 1 };
  }

  addBar(u: Unit) {
    if (u.def.boss) return;
    const box = el('div', `ubar ${u.side}`, '<i class="fill"></i><i class="sh"></i>');
    this.world.append(box);
    this.bars.set(u, { box, fill: box.querySelector('.fill')!, sh: box.querySelector('.sh')! });
  }
  removeBar(u: Unit) {
    const b = this.bars.get(u);
    if (!b) return;
    b.box.classList.add('gone');
    setTimeout(() => b.box.remove(), 400);
    this.bars.delete(u);
  }

  number(u: Unit, v: number, kind: 'dmg' | 'crit' | 'heal' | 'block' | 'taken') {
    const p = this.project(u.head());
    if (!p.ok) return;
    const n = el('div', `num ${kind}`, kind === 'heal' ? `+${v}` : kind === 'crit' ? `<small>치명</small>${v}` : `${v}`);
    n.style.left = `${p.x + (Math.random() - 0.5) * 36}px`;
    n.style.top = `${p.y - 6 + (Math.random() - 0.5) * 14}px`;
    n.addEventListener('animationend', () => n.remove());
    this.world.append(n);
  }

  banner(title: string, sub = '', danger = false) {
    this.bannerEl.className = `banner ${danger ? 'danger' : ''}`;
    this.bannerEl.innerHTML = `<div class="bt">${title}</div>${sub ? `<div class="bs">${sub}</div>` : ''}`;
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
  }

  cutin(u: Unit, ms = 1300) {
    const ult = u.def.ult!;
    this.cutEl.style.setProperty('--accent', u.def.color);
    this.cutEl.style.setProperty('--dur', `${ms}ms`);
    this.cutEl.innerHTML = `<div class="lines"></div><div class="cbox"><div class="cn">${u.def.name}<small>${u.title ?? u.def.title ?? ''}</small></div><div class="cu">${ult.name}</div><div class="cd">${ult.desc}</div></div>`;
    this.cutEl.className = 'cutin';
    void this.cutEl.offsetWidth;
    this.cutEl.classList.add('show');
    setTimeout(() => { this.cutEl.classList.remove('show'); this.flash('rgba(255,255,255,.55)'); }, ms);
  }

  flash(color: string) {
    this.flashEl.style.background = color;
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }

  hint(on: boolean) { this.hintEl.classList.toggle('hide', !on); this.root.classList.toggle('targeting', on); }

  update(b: Battle) {
    this.world.classList.toggle('hide', b.frozen);
    this.waveEl.innerHTML = b.wave >= 0 ? `<b>${b.waveTitle}</b><span>${b.wave + 1} / ${b.waveCount}</span>` : '';
    this.heroes.forEach((h, i) => {
      const c = this.cards[i];
      c.hp.style.width = `${(h.hp / h.maxHp) * 100}%`;
      c.sh.style.width = `${Math.min(1, h.shield / h.maxHp) * 100}%`;
      c.g.style.width = `${h.gauge}%`;
      c.hpTxt.textContent = `${Math.ceil(h.hp)}`;
      c.box.classList.toggle('full', h.alive && h.gauge >= 100);
      c.box.classList.toggle('dead', !h.alive);
      c.box.classList.toggle('aiming', b.targeting === h);
    });
    for (const [u, bar] of this.bars) {
      const p = this.project(u.head());
      bar.box.style.transform = `translate(${p.x}px, ${p.y}px)`;
      bar.box.style.opacity = p.ok ? '' : '0';
      bar.fill.style.width = `${(u.hp / u.maxHp) * 100}%`;
      bar.sh.style.width = `${Math.min(1, u.shield / u.maxHp) * 100}%`;
    }
    const boss = b.units.find(u => u.def.boss && u.alive);
    this.bossEl.classList.toggle('hide', !boss);
    if (boss) {
      this.bossEl.querySelector('.bn')!.textContent = boss.def.name;
      const w = `${(boss.hp / boss.maxHp) * 100}%`;
      (this.bossEl.querySelector('.fill') as HTMLElement).style.width = w;
      (this.bossEl.querySelector('.lag') as HTMLElement).style.width = w;
    }
  }

  result(win: boolean, heroes: Unit[], time: number, reward: { gold: number; gems: number; stone?: number; lines?: string[]; title?: string; items?: Item[]; first?: boolean; stars?: { text: string; met: boolean; was: boolean }[] } | null, onRetry: () => void, onLobby: () => void) {
    const max = Math.max(1, ...heroes.map(h => Math.max(h.dmgDone, h.healDone, h.dmgTaken)));
    const row = (h: Unit) => `
      <div class="rr" style="--accent:${h.def.color}">
        <div class="rn">${h.def.name}</div>
        <div class="rbars">
          <div class="rb d"><i style="width:${(h.dmgDone / max) * 100}%"></i><span>피해 ${Math.round(h.dmgDone).toLocaleString()}</span></div>
          <div class="rb h"><i style="width:${(h.healDone / max) * 100}%"></i><span>치유 ${Math.round(h.healDone).toLocaleString()}</span></div>
          <div class="rb t"><i style="width:${(h.dmgTaken / max) * 100}%"></i><span>받은 피해 ${Math.round(h.dmgTaken).toLocaleString()}</span></div>
        </div>
      </div>`;
    this.resultEl.innerHTML = `
      <div class="rbox ${win ? 'win' : 'lose'}">
        <div class="rt">${reward?.title ?? (win ? '승리' : '패배')}</div>
        <div class="rs">전투 시간 ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}</div>
        ${reward ? `<div class="rw"><span class="gold">${reward.gold.toLocaleString()}</span>${reward.gems ? `<span class="gem">${reward.gems.toLocaleString()}</span>` : ''}${reward.stone ? `<span class="stone">강화석 ${reward.stone}</span>` : ''}</div>` : ''}
        ${reward?.lines?.length ? `<div class="rlines">${reward.lines.map(l => `<span>${l}</span>`).join('')}</div>` : ''}
        ${reward?.stars ? `<div class="rstars">${reward.stars.map(st => `<div class="rst ${st.met || st.was ? 'on' : ''}"><i>★</i>${st.text}${st.met && !st.was ? '<small>NEW</small>' : ''}</div>`).join('')}</div>` : ''}
        ${reward?.items?.length ? `<div class="rdrop">${reward.items.map(it => `<div class="drop" style="--gc:${GRADE_COLORS[it.grade]}"><i class="ico" style="--ico:url(${ITEM_ICON(it)})"></i><span><small>${GRADES[it.grade]}</small>${baseOf(it).name}</span></div>`).join('')}</div>` : ''}
        ${heroes.map(row).join('')}
        <div class="rbtns"><button class="lobby">로비로</button><button class="retry">다시 하기</button></div>
      </div>`;
    this.resultEl.querySelector('.retry')!.addEventListener('click', onRetry);
    this.resultEl.querySelector('.lobby')!.addEventListener('click', onLobby);
    this.resultEl.classList.remove('hide');
  }
}
