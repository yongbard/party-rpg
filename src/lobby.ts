// 로비: 파티가 카메라를 보고 서 있다. 아래 탭으로 [모험](스테이지 선택·파티 편성) / [영웅](가진 영웅 전부: 능력치·레벨업·승격·장비) / [소환] / [가방]
import { Color3, Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import type { Assets } from './assets';
import type { CameraRig } from './camera';
import { CHAPTERS, chapterOf, COL, GRADES, GRADE_COLORS, HEROES, STAGES, gradeMul, heroMul, levelCost, maxLevel, repeatGems, type UnitDef } from './data';
import { BANNERS, canPromote, heroRates, hiFrom, pickupHero, promote, PROMOTE, RATES, salvage, SALVAGE_GOLD, summon, type BannerId } from './gacha';
import { showSummon } from './summonView';
import { baseOf, canEquip, EQUIP_SLOTS, fmtStat, ITEM_ICON, SLOT_NAMES, STAT_NAMES, type EquipSlot, type Item, type Slot } from './items';
import { loadout, wearerOf } from './loadout';
import { lookKeys, makeHeroModel } from './heroModel';
import type { Fx } from './fx';
import type { Hud } from './hud';
import { writeSave, type SaveData } from './save';
import { Unit } from './unit';

// 카메라에서 보면 +x 가 왼쪽이다 (오른손 좌표계, 카메라가 +z 를 본다)
const LINEUP = [2.4, 0.8, -0.8, -2.4];
const slotPos = (i: number) => new Vector3(LINEUP[i], 0, 3 + Math.abs(LINEUP[i]) * 0.25);
const GUEST_POS = new Vector3(0, 0, 2.6);   // 파티 밖 영웅을 볼 때 혼자 서는 자리
const SLOT_NAMES_KO = ['앞줄 왼쪽', '앞줄 오른쪽', '뒷줄 왼쪽', '뒷줄 오른쪽'];

type Tab = 'adventure' | 'hero' | 'summon' | 'bag';
const fmt = (n: number) => Math.round(n).toLocaleString();

export class Lobby {
  onStart: (stageId: string) => void = () => {};
  units: Unit[] = [];
  portraits: Record<string, string> = {};
  snap: (ids: string[]) => void = () => {};   // 초상화를 다시 찍는다 (main 이 넣어 준다)
  private el: HTMLElement;
  private plates: HTMLElement[] = [];
  private selected = STAGES[0].id;
  private tab: Tab = 'adventure';
  private heroId = '';                 // 영웅 탭에서 고른 영웅
  private guest: Unit | null = null;   // 파티 밖 영웅을 고르면 가운데에 혼자 세운다
  private forming = false;             // 모험 탭: 파티 편성 화면
  private save!: SaveData;
  private preview: number | null = null;   // 영웅 탭에서 미리 보는 등급 (null = 지금 등급)
  private heroView: 'info' | 'gear' = 'info';
  private gearSlot: EquipSlot | null = null;   // 장비 탭에서 고른 칸
  private bagFilter: Slot | 'all' = 'all';
  private bagSel: number | null = null;
  private banner: BannerId = 'hero';
  private showRates = false;

  constructor(private scene: Scene, private assets: Assets, private shadow: ShadowGenerator, private rig: CameraRig, private hud: Hud, private fx: Fx) {
    this.el = document.createElement('div');
    this.el.id = 'lobby';
    document.getElementById('app')!.append(this.el);
  }

  show(save: SaveData) {
    this.save = save;
    this.rig.setView('lobby', true);
    this.units = save.party.map((id, i) => this.makeUnit(HEROES.find(h => h.id === id)!, slotPos(i), save.heroes[id].grade));
    if (!save.heroes[this.heroId]) this.heroId = save.party[0];
    this.forming = false;
    this.selected = this.frontier(-1);
    this.tab = 'adventure';
    this.render();
    this.el.style.display = '';
  }

  /** 열린 스테이지 중 안 깬 첫째 (다 깼으면 마지막). ch 를 주면 그 장 안에서 */
  private frontier(ch: number) {
    const open = STAGES.filter((st, i) => (i === 0 || this.save.cleared.includes(STAGES[i - 1].id)) && (ch < 0 || chapterOf(st) === ch));
    return (open.find(s => !this.save.cleared.includes(s.id)) ?? open[open.length - 1]).id;
  }

  /** pos 에 그 등급 외형으로 영웅을 세운다 (외형 파일은 미리 받아 둬야 한다) */
  private makeUnit(def: UnitDef, pos: Vector3, grade: number) {
    const lo = loadout(this.save, def.id, grade);
    const model = makeHeroModel(this.assets, this.scene, lo.look, this.shadow, this.fx);
    const u = new Unit(def, 'hero', model, pos.clone(), Math.PI, lo.mul, lo.bonus);
    u.title = lo.title;
    u.play(def.anims.idle);
    return u;
  }

  /** 지금 서 있는 영웅들 (파티 + 혼자 선 영웅). 초상화 촬영용 */
  shown() { return this.guest ? [...this.units, this.guest] : this.units; }
  private unitOf(id: string) { return this.shown().find(u => u.def.id === id) ?? null; }
  private cur() { return this.unitOf(this.heroId)!; }
  /** 가진 영웅: 파티 먼저, 그다음 잠재 등급 높은 순 */
  private owned() {
    const s = this.save;
    const inP = (id: string) => (s.party.includes(id) ? 1 : 0);
    return HEROES.filter(h => s.heroes[h.id]).sort((a, b) => inP(b.id) - inP(a.id) || (b.maxGrade ?? 2) - (a.maxGrade ?? 2));
  }
  private applyVisibility() { this.units.forEach(u => u.root.setEnabled(!this.guest)); }

  /** 영웅 탭에서 파티 밖 영웅을 고르면 가운데에 혼자 세우고, 아니면 치운다 */
  private async syncGuest() {
    const id = this.heroId;
    if (this.tab !== 'hero' || this.save.party.includes(id)) {
      this.guest?.model.dispose();
      this.guest = null;
    } else if (this.guest?.def.id !== id) {
      await this.assets.ensure(lookKeys(loadout(this.save, id).look));
      if (this.heroId !== id || this.tab !== 'hero') return;   // 기다리는 사이 바뀌었다
      this.guest?.model.dispose();
      this.guest = this.makeUnit(HEROES.find(h => h.id === id)!, GUEST_POS, this.save.heroes[id].grade);
    }
    this.applyVisibility();
    if (this.guest && !this.portraits[id]) await this.takePortraits([id]);
  }

  private async takePortraits(ids: string[]) {
    await this.scene.whenReadyAsync();
    this.snap(ids);
    this.applyVisibility();
    this.rig.usemain();
  }

  /** 영웅 탭: 다른 등급의 외형을 3D 로 바꿔 보여 준다 */
  private async showGrade(grade: number | null) {
    const id = this.heroId;
    this.preview = grade;
    await this.rebuild(id);
    if (this.heroId !== id) return;
    this.fx.ring(this.cur().pos, COL.gold, 1.6, 0.5);
    this.render();
  }

  /** 외형이 바뀐 영웅을 그 자리에 다시 세운다 (서 있으면) */
  private async rebuild(heroId: string) {
    if (!this.unitOf(heroId)) return;
    const g = heroId === this.heroId && this.preview !== null ? this.preview : this.save.heroes[heroId].grade;
    await this.assets.ensure(lookKeys(loadout(this.save, heroId, g).look));
    const old = this.unitOf(heroId);
    if (!old) return;   // 기다리는 사이 치웠다
    const u = this.makeUnit(old.def, old.home, g);
    old.model.dispose();
    if (this.guest === old) this.guest = u;
    else this.units[this.units.indexOf(old)] = u;
    this.applyVisibility();
  }

  /** 모험 탭 편성: 누르면 파티에 넣거나 뺀다 (최소 1명, 최대 4명) */
  private async toggleMember(id: string) {
    const p = this.save.party;
    if (p.includes(id)) { if (p.length <= 1) return; p.splice(p.indexOf(id), 1); }
    else { if (p.length >= 4) return; p.push(id); }
    writeSave(this.save);
    const s = this.save;
    await this.assets.ensure(s.party.flatMap(h => lookKeys(loadout(s, h).look)));
    this.units.forEach(u => u.model.dispose());
    this.units = s.party.map((h, i) => this.makeUnit(HEROES.find(d => d.id === h)!, slotPos(i), s.heroes[h].grade));
    const missing = s.party.filter(h => !this.portraits[h]);
    if (missing.length) await this.takePortraits(missing);
    this.render();
  }

  private async equip(slot: EquipSlot, uid: number | null) {
    const s = this.save;
    const id = this.heroId;
    const eq = (s.heroes[id].equip ??= {});
    const touched = new Set([id]);
    if (uid === null) delete eq[slot];
    else {
      const other = wearerOf(s, uid);   // 다른 영웅이 끼고 있으면 빼 온다
      if (other) {
        const oe = s.heroes[other].equip!;
        for (const k of EQUIP_SLOTS) if (oe[k] === uid) delete oe[k];
        touched.add(other);
      }
      eq[slot] = uid;
      const it = s.items!.find(i => i.uid === uid)!;
      if (slot === 'weapon' && baseOf(it).hands === 2) delete eq.offhand;   // 양손 무기면 방패를 뺀다
    }
    writeSave(s);
    this.gearSlot = null;
    await Promise.all([...touched].map(h => this.rebuild(h)));
    const u = this.cur();
    this.fx.ring(u.pos, COL.gold, 1.8, 0.5);
    this.fx.burst(u.chest(), COL.gold, 18, 3, 0.2);
    this.render();
  }

  hide() {
    this.units.forEach(u => u.model.dispose());
    this.units = [];
    this.guest?.model.dispose();
    this.guest = null;
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

  private async setTab(t: Tab) {
    if (this.preview !== null) void this.showGrade(null);
    this.tab = t;
    this.forming = false;
    this.render();
    await this.syncGuest();
    if (this.tab !== t) return;
    if (t === 'hero') this.rig.focus(this.cur());
    else this.rig.setView('lobby');
    this.render();
  }

  private async pickHero(id: string) {
    if (this.preview !== null) void this.showGrade(null);
    this.heroId = id;
    this.gearSlot = null;
    this.render();
    await this.syncGuest();
    if (this.heroId !== id) return;
    this.rig.focus(this.cur());
    this.render();
  }

  private render() {
    const s = this.save;
    this.el.innerHTML = `
      <div class="lb-top">
        <div class="res"><i class="ic-gold"></i><b>${fmt(s.gold)}</b></div>
        <div class="res"><i class="ic-gem"></i><b>${fmt(s.gems)}</b></div>
      </div>
      <div class="lb-plates ${this.tab !== 'adventure' ? 'hide' : ''}">${this.units.map(u => `
        <div class="plate" style="--accent:${u.def.color}"><b>${u.def.name}</b><span>Lv.${s.heroes[u.def.id].level}</span></div>`).join('')}
      </div>
      <div class="lb-bottom">
        ${this.tab === 'adventure' ? this.adventureHtml() : this.tab === 'hero' ? this.heroHtml() : this.tab === 'summon' ? this.summonHtml() : this.bagHtml()}
        <div class="lb-tabs">
          <button data-tab="adventure" class="${this.tab === 'adventure' ? 'on' : ''}">모험</button>
          <button data-tab="hero" class="${this.tab === 'hero' ? 'on' : ''}">영웅</button>
          <button data-tab="summon" class="${this.tab === 'summon' ? 'on' : ''}">소환</button>
          <button data-tab="bag" class="${this.tab === 'bag' ? 'on' : ''}">가방</button>
        </div>
      </div>`;
    this.plates = [...this.el.querySelectorAll<HTMLElement>('.plate')];
    this.el.querySelectorAll<HTMLButtonElement>('.lb-tabs button').forEach(b => { b.onclick = () => void this.setTab(b.dataset.tab as Tab); });
    const on = (sel: string, fn: (b: HTMLButtonElement) => void) => this.el.querySelectorAll<HTMLButtonElement>(sel).forEach(b => { b.onclick = () => fn(b); });
    if (this.tab === 'adventure') {
      on('.stage', b => { this.selected = b.dataset.id!; this.render(); });
      on('.chp', b => { this.selected = this.frontier(chapterOf(STAGES.find(st => st.id === this.selected)!) + Number(b.dataset.d)); this.render(); });
      on('.lb-go.start', () => this.onStart(this.selected));
      on('.form-t', () => { this.forming = !this.forming; this.render(); });
      on('.fr', b => void this.toggleMember(b.dataset.id!));
    } else if (this.tab === 'summon') {
      on('.ban', b => { this.banner = b.dataset.b as BannerId; this.render(); });
      on('.pull', b => this.pull(Number(b.dataset.n) as 1 | 10));
      on('.rates-t', () => { this.showRates = !this.showRates; this.render(); });
    } else if (this.tab === 'bag') {
      on('.flt', b => { this.bagFilter = b.dataset.f as Slot | 'all'; this.bagSel = null; this.render(); });
      on('.tile', b => { this.bagSel = Number(b.dataset.uid); this.render(); });
      on('.salv', b => this.salvage(b.dataset.uid ? [Number(b.dataset.uid)] : this.lowItems()));
    } else {
      on('.seg button', b => { this.heroView = b.dataset.v as 'info' | 'gear'; this.gearSlot = null; this.render(); });
      on('.eslot', b => { const sl = b.dataset.slot as EquipSlot; this.gearSlot = this.gearSlot === sl ? null : sl; this.render(); });
      on('.cand', b => void this.equip(this.gearSlot!, Number(b.dataset.uid)));
      on('.unequip', () => void this.equip(this.gearSlot!, null));
      on('.chip', b => void this.pickHero(b.dataset.id!));
      this.el.querySelectorAll<HTMLButtonElement>('.rung').forEach(b => {
        b.onclick = () => {
          const g = Number(b.dataset.g);
          void this.showGrade(g === this.save.heroes[this.heroId].grade ? null : g);
        };
      });
      this.el.querySelectorAll<HTMLButtonElement>('.lvup').forEach(b => { b.onclick = () => this.levelUp(Number(b.dataset.n)); });
      on('.promo-go', () => void this.promoteHero());
    }
  }

  private adventureHtml() {
    const s = this.save;
    if (this.forming) return this.formHtml();
    const isOpen = (i: number) => i === 0 || s.cleared.includes(STAGES[i - 1].id);
    const partyPower = this.units.reduce((sum, u) => sum + loadout(s, u.def.id).power, 0);
    // 고른 스테이지의 장만 보인다. 다음 장은 그 장 첫 스테이지가 열려야 넘어간다
    const ch = chapterOf(STAGES.find(st => st.id === this.selected)!);
    const nextAt = STAGES.findIndex(st => chapterOf(st) === ch + 1);
    return `
      <div class="lb-panel">
        <div class="lb-ch"><span class="chn"><button class="chp" data-d="-1" ${ch === 0 ? 'disabled' : ''}>‹</button>${CHAPTERS[ch]}<button class="chp" data-d="1" ${nextAt < 0 || !isOpen(nextAt) ? 'disabled' : ''}>›</button></span><span class="pp">파티 전투력 <b>${fmt(partyPower)}</b></span></div>
        <div class="lb-stages">${STAGES.map((st, i) => {
          if (chapterOf(st) !== ch) return '';
          const cleared = s.cleared.includes(st.id);
          return `
          <button class="stage ${st.id === this.selected ? 'sel' : ''} ${isOpen(i) ? '' : 'locked'} ${st.waves.some(w => w.boss) ? 'is-boss' : ''}" data-id="${st.id}" ${isOpen(i) ? '' : 'disabled'}>
            <span class="sid">${st.id}</span>
            <span class="snm">${st.name}<em>적 Lv.${st.level}</em>${cleared ? '<i class="ok">클리어</i>' : ''}</span>
            <span class="srw"><i class="ic-gold"></i>${st.reward.gold}<i class="ic-gem"></i>${cleared ? repeatGems(st) : st.reward.gems}</span>
          </button>`;
        }).join('')}
        </div>
        <div class="go-row"><button class="form-t">편성</button><button class="lb-go start">출전</button></div>
      </div>`;
  }

  private face(id: string) {
    const d = HEROES.find(h => h.id === id)!;
    return this.portraits[id] ? `<img src="${this.portraits[id]}" alt="">` : `<b class="ini" style="color:${d.color}">${d.name[0]}</b>`;
  }

  private formHtml() {
    const s = this.save;
    return `
      <div class="lb-panel form">
        <div class="lb-ch">파티 편성<span class="pp">파티 <b>${s.party.length} / 4</b></span></div>
        <div class="fslots">${SLOT_NAMES_KO.map((n, i) => {
          const id = s.party[i];
          const d = id ? HEROES.find(h => h.id === id)! : null;
          return `<div class="fslot ${d ? '' : 'empty'}" style="--accent:${d?.color ?? '#555'}">${d ? `${this.face(d.id)}<b>${d.name}</b>` : '<b>비어 있음</b>'}<small>${n}</small></div>`;
        }).join('')}</div>
        <div class="froster">${this.owned().map(d => {
          const h = s.heroes[d.id];
          const k = s.party.indexOf(d.id);
          return `<button class="fr ${k >= 0 ? 'in' : ''}" data-id="${d.id}" style="--gc:${GRADE_COLORS[h.grade]}">${this.face(d.id)}${k >= 0 ? `<em>${k + 1}</em>` : ''}<span>${d.name}</span><small>Lv.${h.level}</small></button>`;
        }).join('')}</div>
        <div class="empty-note">누르면 넣고 뺀다 · 넣은 순서대로 앞줄 왼쪽부터 선다 · 1 ~ 4명</div>
        <button class="lb-go form-t">완료</button>
      </div>`;
  }

  private heroHtml() {
    const s = this.save;
    const d: UnitDef = HEROES.find(h => h.id === this.heroId)!;
    const lv = s.heroes[d.id].level;
    const grade = s.heroes[d.id].grade;
    const shown = this.preview ?? grade;
    const gm = gradeMul(grade);
    const m = heroMul(lv) * gm, m2 = heroMul(lv + 1) * gm;
    const max = d.maxGrade ?? 2;
    const MAXL = maxLevel(grade);
    const ladder = Array.from({ length: max + 1 }, (_, g) => `
      <button class="rung ${g === shown ? 'on' : ''} ${g === grade ? 'cur' : ''} ${g > grade ? 'future' : ''}" data-g="${g}" style="--gc:${GRADE_COLORS[g]}">
        <i>${GRADES[g]}</i><span>${d.titles?.[g] ?? ''}</span>
      </button>`).join('');
    const st = d.stats;
    const lo = loadout(s, d.id);
    const bn = lo.bonus;
    const grow = (base: number) => (lv < MAXL ? `<em>+${fmt(base * m2 - base * m)}</em>` : '');
    const costOf = (n: number) => { let c = 0; for (let i = 0; i < n; i++) c += levelCost(lv + i); return c; };
    const btn = (n: number) => {
      const left = MAXL - lv;
      const c = costOf(Math.min(n, left));
      return `<button class="lvup" data-n="${n}" ${left > 0 && s.gold >= c ? '' : 'disabled'}><b>Lv +${n}</b><span><i class="ic-gold"></i>${left > 0 ? fmt(c) : '최대'}</span></button>`;
    };
    const skills = d.skills.map(k => `<li><b>${k.name}</b><small>재사용 ${k.cd}초</small><p>${k.desc ?? ''}</p></li>`).join('');
    return `
      <div class="lb-panel hero" style="--accent:${d.color}">
        <div class="chips">${this.owned().map(x => `
          <button class="chip ${x.id === this.heroId ? 'on' : ''} ${s.party.includes(x.id) ? 'party' : ''}" data-id="${x.id}" style="--accent:${x.color}">${this.face(x.id)}<span>Lv.${s.heroes[x.id].level}</span></button>`).join('')}
        </div>
        <div class="hd-head">
          <div><div class="hd-title" style="color:${GRADE_COLORS[grade]}">${GRADES[grade]} · ${d.titles?.[grade] ?? ''}</div><div class="hd-name">${d.name}<span>Lv.${lv}<small>/${MAXL}</small></span></div></div>
          <div class="hd-power"><small>전투력</small><b>${fmt(lo.power)}</b></div>
        </div>
        <div class="ladder">${ladder}</div>
        ${shown !== grade ? `<div class="ladder-note">${GRADES[shown]} 「${d.titles?.[shown] ?? ''}」 외형 미리보기 · ${shown > grade ? '같은 영웅 조각으로 승격하면 이 모습이 된다' : '지나온 모습'}</div>` : `<div class="ladder-note">최대 ${GRADES[max]}까지 성장 · 칭호를 누르면 그 등급 외형을 미리 본다</div>`}
        ${this.promoHtml(d.id)}
        <div class="seg"><button data-v="info" class="${this.heroView === 'info' ? 'on' : ''}">능력치 · 스킬</button><button data-v="gear" class="${this.heroView === 'gear' ? 'on' : ''}">장비</button></div>
        ${this.heroView === 'gear' ? this.gearHtml(d.id) : `
        <div class="hd-stats">
          <div><small>체력</small><b>${fmt(st.hp * m + bn.hp)}</b>${grow(st.hp)}</div>
          <div><small>공격력</small><b>${fmt((st.atk * m + bn.atk) * (1 + bn.atkPct))}</b>${grow(st.atk)}</div>
          <div><small>방어력</small><b>${fmt(st.def * m + bn.def)}</b>${grow(st.def)}</div>
          <div><small>공격 속도</small><b>${fmt(st.spd + bn.spd)}</b></div>
          <div><small>치명타</small><b>${((st.crit + bn.crit) * 100).toFixed(1)}%</b></div>
          <div><small>치명 피해</small><b>${Math.round((st.critDmg + bn.critDmg) * 100)}%</b></div>
        </div>
        <ul class="hd-skills">
          ${d.ult ? `<li class="ult"><b>${d.ult.name}</b><small>필살기</small><p>${d.ult.desc}</p></li>` : ''}${skills}
        </ul>
        <div class="hd-lv">${btn(1)}${btn(5)}</div>`}
      </div>`;
  }

  /** 등급 승격 줄: 조각·골드와 다음 칭호 */
  private promoHtml(id: string) {
    const s = this.save;
    const d = HEROES.find(h => h.id === id)!;
    const g = s.heroes[id].grade;
    const have = s.shards?.[id] ?? 0;
    if (g >= (d.maxGrade ?? 2)) return `<div class="promo max"><span>조각 <b>${fmt(have)}</b></span><span>최대 등급</span></div>`;
    const [need, gold] = PROMOTE[g];
    const why = canPromote(s, id);
    return `<div class="promo" style="--gc:${GRADE_COLORS[g + 1]}">
      <span class="pbar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i><b>조각 ${fmt(have)} / ${need}</b></span>
      <button class="promo-go" ${why ? 'disabled' : ''}><b>승격</b><small>${GRADES[g + 1]} · ${d.titles?.[g + 1] ?? ''}</small><span><i class="ic-gold"></i>${fmt(gold)}</span></button>
    </div>`;
  }

  private async promoteHero() {
    const s = this.save;
    const d = this.cur().def;
    const from = s.heroes[d.id].grade;
    if (!promote(s, d.id)) return;
    this.preview = null;
    await this.rebuild(d.id);
    const u = this.cur();
    // 외형이 바뀌었으니 초상화를 다시 찍는다 (빛 효과가 얼굴을 덮기 전에)
    await this.takePortraits([d.id]);
    // 연출: 등급 색 빛기둥과 링, 환호, 칭호가 바뀌는 글
    const c = Color3.FromHexString(GRADE_COLORS[from + 1]);
    this.fx.pillar(u.pos, c, 1.2);
    this.fx.ring(u.pos, c, 2.6, 0.8);
    this.fx.burst(u.chest(), c, 60, 6, 0.25);
    u.play(d.anims.victory ?? d.anims.idle, false);
    u.curAnim?.onAnimationGroupEndObservable.addOnce(() => u.play(d.anims.idle));
    this.render();
    const pop = document.createElement('div');
    pop.className = 'promopop';
    pop.style.setProperty('--gc', GRADE_COLORS[from + 1]);
    pop.innerHTML = `<small>등급 승격</small><b>${GRADES[from + 1]}</b><span>${d.titles?.[from] ?? ''} → ${d.titles?.[from + 1] ?? ''}</span>`;
    pop.addEventListener('animationend', () => pop.remove());
    this.el.append(pop);
  }

  private summonHtml() {
    const s = this.save;
    const bn = BANNERS.find(b => b.id === this.banner)!;
    const p = s.pity ?? { hero: 0, hero5: 0, gear: 0, pick: 0 };
    const pick = this.banner === 'pickup' ? pickupHero() : null;
    const pity = bn.pity.map(x => `${x.key === 'pick' ? '픽업 영웅' : `${GRADES[x.min]} 이상`}까지 <b>${x.n - (p[x.key] ?? 0)}</b>회`).join(' · ');
    const rates = this.banner === 'hero' || pick
      ? heroRates(pick?.def.id).map(r => `<li style="--gc:${GRADE_COLORS[r.grade]}"><i>${GRADES[r.grade]}</i>${r.name}<b>${r.pct.toFixed(r.pct < 1 ? 2 : 1)}%</b></li>`).join('')
      : RATES.map((r, g) => `<li style="--gc:${GRADE_COLORS[g]}"><i>${GRADES[g]}</i><b>${r}%</b></li>`).join('');
    const btn = (n: 1 | 10) => {
      const c = n === 10 ? bn.cost10 : bn.cost;
      return `<button class="pull" data-n="${n}" ${s.gems >= c ? '' : 'disabled'}><b>${n}회</b><span><i class="ic-gem"></i>${fmt(c)}</span></button>`;
    };
    return `
      <div class="lb-panel summon">
        <div class="lb-ch">소환<span class="pp">보석<b>${fmt(s.gems)}</b></span></div>
        <div class="bans">${BANNERS.map(b => `<button class="ban ${b.id === this.banner ? 'on' : ''}" data-b="${b.id}">${b.name}</button>`).join('')}</div>
        <div class="sm-info">
          ${pick ? `<div class="pick" style="--accent:${pick.def.color}">${this.face(pick.def.id)}<div><small>이번 주 픽업 · ${pick.left}일 남음</small><b>${pick.def.name}</b><span style="color:${GRADE_COLORS[pick.def.maxGrade ?? 2]}">잠재 ${GRADES[pick.def.maxGrade ?? 2]} · ${pick.def.title ?? ''}</span></div></div>` : ''}
          <p>${bn.desc}</p>
          <div class="sm-pity">10회에 ${GRADES[bn.ten]} 이상 1개 보장${pity ? ` · ${pity}` : ''}</div>
        </div>
        <button class="rates-t">확률표 ${this.showRates ? '닫기' : '보기'}</button>
        ${this.showRates ? `<ul class="rates">${rates}</ul>` : ''}
        <div class="hd-lv">${btn(1)}${btn(10)}</div>
      </div>`;
  }

  private pull(n: 1 | 10) {
    const pulls = summon(this.save, this.banner, n);
    if (!pulls) return;
    this.render();
    const bn = BANNERS.find(b => b.id === this.banner)!;
    const c = n === 10 ? bn.cost10 : bn.cost;
    showSummon(pulls, this.portraits, hiFrom(this.banner), { label: `한 번 더 · ${fmt(c)}`, ok: this.save.gems >= c }, () => this.pull(n), () => this.render());
  }

  /** 일괄 분해 대상: 끼지 않은 일반·고급 */
  private lowItems() {
    return (this.save.items ?? []).filter(i => i.grade <= 1 && !wearerOf(this.save, i.uid)).map(i => i.uid);
  }

  private salvage(uids: number[]) {
    const r = salvage(this.save, uids);
    if (!r.n) return;
    this.bagSel = null;
    this.render();
    const pop = document.createElement('div');
    pop.className = 'lvpop';
    pop.textContent = `분해 ${r.n}개  +${fmt(r.gold)} 골드`;
    pop.addEventListener('animationend', () => pop.remove());
    this.el.append(pop);
  }

  /** 아이템 한 줄 (아이콘, 등급, 이름, 주옵션) */
  private itemRow(it: Item, extra = '') {
    const b = baseOf(it);
    return `<i class="ico" style="--ico:url(${ITEM_ICON(it)});--gc:${GRADE_COLORS[it.grade]}"></i>
      <span class="inm"><small style="color:${GRADE_COLORS[it.grade]}">${GRADES[it.grade]}</small>${b.name}${extra}</span>
      <span class="ist">${STAT_NAMES[it.main[0]]} ${fmtStat(...it.main)}${it.subs.length ? ` <em>+${it.subs.length}</em>` : ''}</span>`;
  }

  private gearHtml(heroId: string) {
    const s = this.save;
    const eq = s.heroes[heroId].equip ?? {};
    const items = s.items ?? [];
    const get = (sl: EquipSlot) => items.find(i => i.uid === eq[sl]);
    const weapon = get('weapon');
    const slots = EQUIP_SLOTS.map(sl => {
      const it = get(sl);
      const lock = sl === 'offhand' && weapon && baseOf(weapon).hands === 2;
      return `<button class="eslot ${this.gearSlot === sl ? 'on' : ''} ${lock ? 'lock' : ''}" data-slot="${sl}" ${lock ? 'disabled' : ''} style="--gc:${it ? GRADE_COLORS[it.grade] : 'rgba(255,255,255,.12)'}">
        ${it ? `<i class="ico" style="--ico:url(${ITEM_ICON(it)})"></i>` : '<i class="ico empty"></i>'}
        <span>${lock ? '양손' : SLOT_NAMES[sl]}</span></button>`;
    }).join('');
    let list = '';
    if (this.gearSlot) {
      const sl = this.gearSlot;
      const cur = get(sl);
      const cands = items.filter(i => i.uid !== cur?.uid && canEquip(heroId, sl, i, sl === 'offhand' ? weapon : undefined) === null)
        .sort((a, b) => b.grade - a.grade || b.main[1] - a.main[1]);
      const who = (uid: number) => { const w = wearerOf(s, uid); return w ? ` <em class="who">${HEROES.find(h => h.id === w)!.name} 착용</em>` : ''; };
      list = `<div class="cands">
        ${cur ? `<div class="cur-item">${this.itemRow(cur)}<button class="unequip">해제</button></div>` : ''}
        ${cands.length ? cands.map(i => `<button class="cand">${this.itemRow(i, who(i.uid))}</button>`.replace('class="cand"', `class="cand" data-uid="${i.uid}"`)).join('') : `<div class="empty-note">낄 수 있는 ${SLOT_NAMES[sl]}이(가) 가방에 없다</div>`}
      </div>`;
    }
    return `<div class="eslots">${slots}</div>${list || '<div class="empty-note">칸을 누르면 가방에서 낄 장비를 고른다 · 무기·방패·투구·갑옷·망토는 모습에 바로 보인다</div>'}`;
  }

  private bagHtml() {
    const s = this.save;
    const items = (s.items ?? []).filter(i => this.bagFilter === 'all' || baseOf(i).slot === this.bagFilter)
      .sort((a, b) => b.grade - a.grade || a.base.localeCompare(b.base));
    const F: [Slot | 'all', string][] = [['all', '전체'], ['weapon', '무기'], ['offhand', '방패'], ['helmet', '투구'], ['armor', '갑옷'], ['cloak', '망토'], ['acc', '장신구'], ['emblem', '문장']];
    const sel = s.items?.find(i => i.uid === this.bagSel);
    const detail = sel ? (() => {
      const b = baseOf(sel);
      const w = wearerOf(s, sel.uid);
      return `<div class="idetail" style="--gc:${GRADE_COLORS[sel.grade]}">
        <i class="ico big" style="--ico:url(${ITEM_ICON(sel)})"></i>
        <div><div class="idn"><small>${GRADES[sel.grade]} · ${SLOT_NAMES[(b.slot === 'acc' ? 'acc1' : b.slot) as EquipSlot]}${b.hands === 2 ? ' · 양손' : ''}</small>${b.name}</div>
        <div class="ids"><b>${STAT_NAMES[sel.main[0]]} ${fmtStat(...sel.main)}</b>${sel.subs.map(([k, v]) => `<span>${STAT_NAMES[k]} +${fmtStat(k, v)}</span>`).join('')}</div>
        <div class="idw">${w ? `${HEROES.find(h => h.id === w)!.name} 착용 중` : '착용 안 함'}</div></div>
        ${w ? '' : `<button class="salv one" data-uid="${sel.uid}">분해<span><i class="ic-gold"></i>${fmt(SALVAGE_GOLD[sel.grade])}</span></button>`}
      </div>`;
    })() : '<div class="empty-note">장비를 누르면 자세히 본다 · 장착은 영웅 탭 → 장비에서</div>';
    return `
      <div class="lb-panel bag">
        <div class="lb-ch">가방<span class="pp">장비 <b>${s.items?.length ?? 0}</b><button class="salv all" ${this.lowItems().length ? '' : 'disabled'}>일반·고급 분해 ${this.lowItems().length}</button></span></div>
        <div class="flts">${F.map(([k, n]) => `<button class="flt ${this.bagFilter === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
        ${detail}
        <div class="tiles">${items.map(i => `<button class="tile ${i.uid === this.bagSel ? 'on' : ''} ${wearerOf(s, i.uid) ? 'worn' : ''}" data-uid="${i.uid}" style="--gc:${GRADE_COLORS[i.grade]}"><i class="ico" style="--ico:url(${ITEM_ICON(i)})"></i></button>`).join('') || '<div class="empty-note">비어 있다</div>'}</div>
      </div>`;
  }

  private levelUp(n: number) {
    const s = this.save;
    const u = this.cur();
    const h = s.heroes[u.def.id];
    let done = 0;
    while (done < n && h.level < maxLevel(h.grade) && s.gold >= levelCost(h.level)) {
      s.gold -= levelCost(h.level);
      h.level++;
      done++;
    }
    if (!done) return;
    writeSave(s);
    u.mul = heroMul(h.level) * gradeMul(h.grade);   // (전투력 표시는 render 가 loadout 으로 다시 잰다)
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
