// 로비: 파티가 카메라를 보고 서 있다. 아래 탭으로 [모험](스테이지 선택·파티 편성) / [던전](요일 던전·무한탑·레이드·모의전) / [영웅](가진 영웅 전부: 능력치·레벨업·승격·장비·행동 방침) / [소환] / [가방]
import { Color3, Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import type { Assets } from './assets';
import type { CameraRig } from './camera';
import { CHAPTERS, chapterOf, COL, condText, GRADES, GRADE_COLORS, HEROES, STAGES, gradeMul, heroMul, levelCost, maxLevel, repeatGems, starCount, starGems, type UnitDef } from './data';
import { ATTEND, claim, claimable, DAILY_BONUS, dailyOf, missionText, progress, refresh, rewardText, track, WEEKLY } from './missions';
import { canRun, DAY_NAMES, DUNGEON_RUNS, DUNGEONS, isOpen, RAID_LEVEL, RAID_LIMIT, RAID_RUNS, RAID_TIERS, raidReward, refreshModes, rewardLine, stageOf, TIER_LEVEL, towerReward, type DungeonId } from './modes';
import { BANNERS, canCraft, canEnhance, canPromote, craft, CRAFT, enhance, enhanceCost, heroRates, hiFrom, pickupHero, promote, PROMOTE, PROMOTE_STONE, RATES, salvage, salvageOf, summon, type BannerId } from './gacha';
import { SETS, UNIQUES, UNIQUE_IDS, uqPower } from './uniques';
import { showSummon } from './summonView';
import { baseOf, canEquip, EQUIP_SLOTS, fmtStat, ITEM_ICON, MAX_ENHANCE, setCounts, SLOT_NAMES, STAT_NAMES, statsOf, type EquipSlot, type Item, type Slot } from './items';
import { equippedItems } from './loadout';
import { fillableSlot, loadout, rivalParty, wearerOf } from './loadout';
import { FACTION_IDS, FACTION_OF, FACTIONS, membersOf, POLICIES, synergy, type FactionId, type Policy } from './tactics';
import { lookKeys, makeHeroModel } from './heroModel';
import type { Fx } from './fx';
import type { Hud } from './hud';
import { writeSave, type SaveData } from './save';
import { auraOf, passivesOf, passiveText, ULT_MUL, ultLevel, branchesOf, canLearn, canStar, learn, MAX_STARS, nodeText, NODE_NEED, pointsOf, RANKS, resetTalents, RESET_GOLD, spentOf, STAR_COST, starUp } from './talents';
import { Unit } from './unit';
import { portraitUrl } from './common';
import { openSettings } from './settings';
import { sound } from './sound';
import { isNew, isOpen as unlocked, markSeen, type Feature } from './unlocks';

// 카메라에서 보면 +x 가 왼쪽이다 (오른손 좌표계, 카메라가 +z 를 본다)
const LINEUP = [2.4, 0.8, -0.8, -2.4];
const slotPos = (i: number) => new Vector3(LINEUP[i], 0, 3 + Math.abs(LINEUP[i]) * 0.25);
const GUEST_POS = new Vector3(0, 0, 2.6);   // 파티 밖 영웅을 볼 때 혼자 서는 자리
const SLOT_NAMES_KO = ['앞줄 왼쪽', '앞줄 오른쪽', '뒷줄 왼쪽', '뒷줄 오른쪽'];

type Tab = 'adventure' | 'dungeon' | 'hero' | 'summon' | 'bag';
// 아래 탭: 이름과 아이콘 (public/icons/ui, game-icons.net CC BY 3.0)
const TABS: [Tab, string, string][] = [['adventure', '모험', 'crossed-swords'], ['dungeon', '던전', 'dungeon-gate'], ['hero', '영웅', 'visored-helm'], ['summon', '소환', 'magic-portal'], ['bag', '가방', 'backpack']];
const uiIcon = (name: string) => new URL(`icons/ui/${name}.svg`, document.baseURI).href;
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
  private missions = false;            // 모험 탭: 임무·출석 화면
  private save!: SaveData;
  private preview: number | null = null;   // 영웅 탭에서 미리 보는 등급 (null = 지금 등급)
  private heroView: 'info' | 'gear' | 'talent' | 'look' = 'info';   // look: 패널을 줄이고 3D 외형을 크게 본다
  private talentSel: [number, number] | null = null;   // 특성 탭에서 고른 노드 (가지, 노드)
  private gearSlot: EquipSlot | null = null;   // 장비 탭에서 고른 칸
  private bagFilter: Slot | 'all' = 'all';
  private bagSel: number | null = null;
  private crafting = false;            // 가방 탭: 제작 화면
  private risen = new Set<string>();   // 새로 열려 이미 떠오른 아래 탭 (다시 그릴 때 등장 애니메이션을 되풀이하지 않게)
  private dview: 'day' | 'tower' | 'raid' | 'mock' = 'day';   // 던전 탭: 요일 던전 / 무한탑 / 레이드 / 모의전
  private mockTeam: 'b' | FactionId = 'kingdom';   // 모의전 상대
  private mockOff = 0;                 // 모의전 AI 상대 레벨 차이
  private forming2 = false;            // 모의전: 파티 B 편성 화면
  private dsel: DungeonId = 'gold';
  private dtier = 1;
  private banner: BannerId = 'hero';
  private showRates = false;

  constructor(private scene: Scene, private assets: Assets, private shadow: ShadowGenerator, private rig: CameraRig, private hud: Hud, private fx: Fx) {
    this.el = document.createElement('div');
    this.el.id = 'lobby';
    document.getElementById('app')!.append(this.el);
    this.el.addEventListener('pointerdown', e => {
      if ((e.target as Element).closest('button')) sound.play('click');
      // 새로 열린 것을 누르면 본 것으로. 다시 그리지 않고 빛만 끈다 (다시 그리면 같은 터치의 click 이 사라진다)
      const f = (e.target as Element).closest<HTMLElement>('[data-feat]');
      if (f && markSeen(this.save, f.dataset.feat as Feature)) { writeSave(this.save); f.removeAttribute('data-new'); }
    });
    addEventListener('resize', () => { if (this.el.style.display !== 'none') this.measure(); });
  }

  /** 3D 영웅이 보일 세로 구간을 카메라에 알린다: 위 자원 줄 아래 ~ 패널 위 (발밑 이름표 자리는 뺀다) */
  private measure() {
    const c = this.scene.getEngine().getRenderingCanvas()!.getBoundingClientRect();
    const top = this.el.querySelector('.lb-top')!.getBoundingClientRect().bottom;
    const bottom = this.el.querySelector('.lb-bottom')!.getBoundingClientRect().top;
    this.rig.setBand((top - c.top) / c.height + 0.01, (bottom - c.top - 30) / c.height);
  }

  /** go: 로비를 열 때 갈 곳 (결과 화면의 바로가기). 없으면 모험 탭 */
  show(save: SaveData, go?: { tab: Tab; heroView?: 'info' | 'gear' | 'talent'; heroId?: string }) {
    this.save = save;
    this.rig.setView('lobby', true);
    this.units = save.party.map((id, i) => this.makeUnit(HEROES.find(h => h.id === id)!, slotPos(i), save.heroes[id].grade));
    if (!save.heroes[this.heroId]) this.heroId = save.party[0];
    this.forming = false;
    this.missions = !go && this.has('missions') && claimable(save).includes('a');   // 오늘 첫 접속이면 출석부터 보여 준다
    this.selected = this.frontier(-1);
    this.tab = go?.tab ?? 'adventure';
    if (go?.heroView) this.heroView = go.heroView;
    if (go?.heroId && save.heroes[go.heroId]) this.heroId = go.heroId;
    this.render();
    this.el.style.display = '';
    this.measure();   // 숨긴 채로 그리면 패널 위치를 못 잰다
    this.rig.setView('lobby', true);
    sound.music('lobby');
    if (this.tab === 'hero') void this.syncGuest().then(() => this.rig.focus(this.cur()));
  }

  /** 진행에 따라 열린 기능인가 (unlocks.ts) */
  private has(f: Feature) { return unlocked(this.save.cleared, f); }
  /** 새로 열린 기능 표시: 빛(data-new)과, 누르면 본 것으로 적는 data-feat */
  private nw(f: Feature) { return `data-feat="${f}" ${isNew(this.save, f) ? 'data-new' : ''}`; }

  /** 할 수 있는 일이 있는 영웅: 파티 영웅의 레벨이 다음 적보다 낮고 골드로 올릴 수 있다, 빈 칸에 낄 장비가 있다, 승격할 수 있다 */
  private heroDot(id: string) {
    const s = this.save, h = s.heroes[id];
    const foe = STAGES.find(st => st.id === this.frontier(-1))!.level;
    return (s.party.includes(id) && h.level < foe && h.level < maxLevel(h.grade, h.stars) && s.gold >= levelCost(h.level))
      || (this.has('gear') && !!fillableSlot(s, id))
      || (this.has('promo') && !canPromote(s, id));
  }
  /** 아래 탭 점: 영웅 탭은 위 heroDot, 소환 탭은 10회 소환할 보석이 있을 때 */
  private tabDot(t: Tab) {
    if (t === 'hero') return this.owned().some(d => this.heroDot(d.id));
    if (t === 'summon') return this.save.gems >= BANNERS[0].cost10;
    return false;
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

  /** 모의전 파티 B: 누르면 넣고 뺀다 (최대 4명, 내 파티와 겹쳐도 된다) */
  private toggleB(id: string) {
    const p = (this.save.party2 ??= []);
    if (p.includes(id)) p.splice(p.indexOf(id), 1);
    else if (p.length < 4) p.push(id);
    writeSave(this.save);
    this.render();
  }

  /** 켜진 진영 시너지 (작게: 한 줄 칩) */
  private synHtml(ids: string[], small = false) {
    const { active } = synergy(ids);
    if (!active.length) return small ? '' : '<div class="syn none">진영 시너지 없음 · 같은 진영 2명이면 소형, 3명 이상이면 대형</div>';
    return `<div class="syn ${small ? 'small' : ''}">${active.map(a => {
      const f = FACTIONS[a.id];
      return `<span style="--fc:${f.color}"><b>${f.name} ${a.n}</b>${f.syn}${a.big ? ' (대형)' : ''}${small ? '' : `<small>${a.text}</small>`}</span>`;
    }).join('')}</div>`;
  }
  private facTag(id: string) {
    const f = FACTIONS[FACTION_OF[id]];
    return f ? `<i class="fac" style="--fc:${f.color}">${f.name}</i>` : '';
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
    this.missions = false;
    this.crafting = false;
    // 던전 탭: 고른 요일 던전이 오늘 닫혀 있으면 열린 것으로
    if (t === 'dungeon') {
      const wd = refreshModes(this.save);
      const d = DUNGEONS.find(x => x.id === this.dsel)!;
      if (!isOpen(d, wd)) { this.dsel = DUNGEONS.find(x => isOpen(x, wd))!.id; this.dtier = Math.min(TIER_LEVEL.length, (this.save.dungeon?.best[this.dsel] ?? 0) + 1); }
    }
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
    // 잠긴 탭·보기에 머물러 있으면 (처음부터 다시 등) 되돌린다
    if (this.tab !== 'adventure' && !this.has(this.tab)) this.tab = 'adventure';
    if (this.dview !== 'day' && !this.has(this.dview)) this.dview = 'day';
    if ((this.heroView === 'gear' || this.heroView === 'talent') && !this.has(this.heroView)) this.heroView = 'info';
    this.el.innerHTML = `
      <div class="lb-top">
        <button class="opt-t" aria-label="설정"><i class="tic" style="--ico:url(${uiIcon('cog')})"></i></button>
        <div class="res"><i class="ic-gold"></i><b>${fmt(s.gold)}</b></div>
        <div class="res"><i class="ic-gem"></i><b>${fmt(s.gems)}</b></div>
      </div>
      <div class="lb-plates ${this.tab !== 'adventure' || this.missions ? 'hide' : ''}">${this.units.map(u => `
        <div class="plate" style="--accent:${u.def.color}"><b>${u.def.name}</b><span>Lv.${s.heroes[u.def.id].level}</span></div>`).join('')}
      </div>
      <div class="lb-bottom">
        ${this.tab === 'adventure' ? this.adventureHtml() : this.tab === 'dungeon' ? this.dungeonHtml() : this.tab === 'hero' ? this.heroHtml() : this.tab === 'summon' ? this.summonHtml() : this.bagHtml()}
        <div class="lb-tabs">${TABS.filter(([t]) => t === 'adventure' || this.has(t)).map(([t, name, icon]) => `
          <button data-tab="${t}" class="${this.tab === t ? 'on' : ''} ${this.risen.has(t) ? 'risen' : ''}" ${t === 'adventure' ? '' : this.nw(t)}><i class="tic" style="--ico:url(${uiIcon(icon)})"></i><span>${name}</span>${this.tabDot(t) ? '<i class="dot"></i>' : ''}</button>`).join('')}
        </div>
      </div>`;
    this.el.querySelectorAll<HTMLElement>('.lb-tabs [data-new]').forEach(b => this.risen.add(b.dataset.tab!));
    this.plates = [...this.el.querySelectorAll<HTMLElement>('.plate')];
    this.measure();
    this.el.querySelectorAll<HTMLButtonElement>('.lb-tabs button').forEach(b => { b.onclick = () => void this.setTab(b.dataset.tab as Tab); });
    (this.el.querySelector('.opt-t') as HTMLButtonElement).onclick = () => openSettings(this.save);
    const on = (sel: string, fn: (b: HTMLButtonElement) => void) => this.el.querySelectorAll<HTMLButtonElement>(sel).forEach(b => { b.onclick = () => fn(b); });
    if (this.tab === 'adventure') {
      on('.stage', b => { this.selected = b.dataset.id!; this.render(); });
      on('.chp', b => { this.selected = this.frontier(chapterOf(STAGES.find(st => st.id === this.selected)!) + Number(b.dataset.d)); this.render(); });
      on('.lb-go.start', () => this.onStart(this.selected));
      on('.form-t', () => { this.forming = !this.forming; this.render(); });
      on('.ms-t', () => { this.missions = !this.missions; this.render(); });
      on('.ms-go', b => this.claimMission(b.dataset.k!));
      this.el.querySelector('.stage.sel')?.scrollIntoView({ block: 'nearest' });
      on('.fr', b => void this.toggleMember(b.dataset.id!));
    } else if (this.tab === 'dungeon') {
      on('.dseg button', b => { this.dview = b.dataset.v as 'day' | 'tower' | 'raid' | 'mock'; this.render(); });
      on('.mk', b => { this.mockTeam = b.dataset.t as 'b' | FactionId; this.forming2 = false; this.render(); });
      on('.moff', b => { this.mockOff = Math.max(-10, Math.min(10, this.mockOff + Number(b.dataset.d))); this.render(); });
      on('.form2-t', () => { this.forming2 = !this.forming2; this.render(); });
      on('.fr2', b => this.toggleB(b.dataset.id!));
      on('.dg[data-d]', b => { this.dsel = b.dataset.d as DungeonId; this.dtier = Math.min(TIER_LEVEL.length, (this.save.dungeon?.best[this.dsel] ?? 0) + 1); this.render(); });
      on('.dtier', b => { this.dtier = Number(b.dataset.t); this.render(); });
      on('.dgo', b => this.onStart(b.dataset.id!));
    } else if (this.tab === 'summon') {
      on('.ban', b => { this.banner = b.dataset.b as BannerId; this.render(); });
      on('.pull', b => this.pull(Number(b.dataset.n) as 1 | 10));
      on('.rates-t', () => { this.showRates = !this.showRates; this.render(); });
    } else if (this.tab === 'bag') {
      on('.flt', b => { this.bagFilter = b.dataset.f as Slot | 'all'; this.bagSel = null; this.render(); });
      on('.tile', b => { this.bagSel = Number(b.dataset.uid); this.render(); });
      on('.salv', b => this.salvage(b.dataset.uid ? [Number(b.dataset.uid)] : this.lowItems()));
      on('.enh', b => this.enhanceItem(Number(b.dataset.uid)));
      on('.craft-t', () => { this.crafting = !this.crafting; this.render(); });
      on('.craft-go', b => this.craftItem(b.dataset.u!));
    } else {
      on('.seg button', b => { this.heroView = b.dataset.v as 'info' | 'gear' | 'talent' | 'look'; this.gearSlot = null; this.render(); this.rig.focus(this.cur()); });
      on('.tn', b => { this.talentSel = [Number(b.dataset.b), Number(b.dataset.i)]; this.render(); });
      on('.tn-go', () => this.learnTalent());
      on('.tn-reset', () => { if (resetTalents(this.save, this.heroId)) { writeSave(this.save); this.refreshBonus(); this.render(); } });
      on('.star-go', () => this.starHero());
      on('.eslot', b => { const sl = b.dataset.slot as EquipSlot; this.gearSlot = this.gearSlot === sl ? null : sl; this.render(); });
      on('.cand', b => void this.equip(this.gearSlot!, Number(b.dataset.uid)));
      on('.unequip', () => void this.equip(this.gearSlot!, null));
      on('.chip', b => { this.talentSel = null; void this.pickHero(b.dataset.id!); });
      this.el.querySelectorAll<HTMLButtonElement>('.rung').forEach(b => {
        b.onclick = () => {
          const g = Number(b.dataset.g);
          if (this.heroView !== 'look') { this.heroView = 'look'; this.render(); this.rig.focus(this.cur()); }   // 미리보기는 3D 로 보이게
          void this.showGrade(g === this.save.heroes[this.heroId].grade ? null : g);
        };
      });
      this.el.querySelectorAll<HTMLButtonElement>('.lvup').forEach(b => { b.onclick = () => this.levelUp(Number(b.dataset.n)); });
      on('.promo-go', () => void this.promoteHero());
      on('.pl', b => { (this.save.policy ??= {})[this.heroId] = b.dataset.p as Policy; writeSave(this.save); this.render(); });
    }
  }

  private adventureHtml() {
    const s = this.save;
    if (this.forming) return this.formHtml();
    if (this.missions) return this.missionsHtml();
    const isOpen = (i: number) => i === 0 || s.cleared.includes(STAGES[i - 1].id);
    const partyPower = this.units.reduce((sum, u) => sum + loadout(s, u.def.id).power, 0);
    // 고른 스테이지의 장만 보인다. 다음 장은 그 장 첫 스테이지가 열려야 넘어간다
    const ch = chapterOf(STAGES.find(st => st.id === this.selected)!);
    const nextAt = STAGES.findIndex(st => chapterOf(st) === ch + 1);
    const inCh = STAGES.filter(st => chapterOf(st) === ch);
    const chStars = inCh.reduce((a, st) => a + starCount(s.stars?.[st.id]), 0), chMax = inCh.length * 3;
    const sel = STAGES.find(st => st.id === this.selected)!;
    const selBits = s.stars?.[sel.id] ?? 0;
    const stars = (bits: number) => [0, 1, 2].map(i => `<i class="${bits & (1 << i) ? 'on' : ''}">★</i>`).join('');
    const dot = claimable(s).length ? '<i class="dot"></i>' : '';
    return `
      <div class="lb-panel">
        <div class="lb-ch"><span class="chn"><button class="chp" data-d="-1" ${ch === 0 ? 'disabled' : ''}>‹</button>${CHAPTERS[ch]}<button class="chp" data-d="1" ${nextAt < 0 || !isOpen(nextAt) ? 'disabled' : ''}>›</button></span><span class="pp"><i class="chs">★ ${chStars} / ${chMax}</i>전투력 <b>${fmt(partyPower)}</b></span></div>
        <div class="lb-stages">${STAGES.map((st, i) => {
          if (chapterOf(st) !== ch) return '';
          const bits = s.stars?.[st.id] ?? 0;
          // 보석: 아직 못 얻은 별의 합, 별을 다 얻었으면 다시 깬 보석
          const gems = starCount(bits) < 3 ? (3 - starCount(bits)) * starGems(st) : repeatGems(st);
          return `
          <button class="stage ${st.id === this.selected ? 'sel' : ''} ${isOpen(i) ? '' : 'locked'} ${st.waves.some(w => w.boss) ? 'is-boss' : ''}" data-id="${st.id}" ${isOpen(i) ? '' : 'disabled'}>
            <span class="sid">${st.id}<span class="sst">${stars(bits)}</span></span>
            <span class="snm">${st.name}<em>적 Lv.${st.level}</em></span>
            <span class="srw"><i class="ic-gold"></i>${st.reward.gold}<i class="ic-gem"></i>${gems}</span>
          </button>`;
        }).join('')}
        </div>
        <div class="conds">${sel.conds.map((c, i) => `<span class="${selBits & (1 << i) ? 'on' : ''}"><i>★</i>${condText(c)}</span>`).join('')}</div>
        ${this.synHtml(s.party, true)}
        <div class="go-row">${this.has('form') ? `<button class="form-t" ${this.nw('form')}>편성</button>` : ''}${this.has('missions') ? `<button class="ms-t" ${this.nw('missions')}>임무${dot}</button>` : ''}<button class="lb-go start">출전</button></div>
      </div>`;
  }

  /** 던전 탭: 요일 던전 / 무한탑 / 레이드 */
  private dungeonHtml() {
    const s = this.save;
    const wd = refreshModes(s);
    const seg = `<div class="seg dseg">${([['day', '요일 던전'], ['tower', '무한탑'], ['raid', '레이드'], ['mock', '모의전']] as const).filter(([v]) => v === 'day' || this.has(v)).map(([v, n]) => `<button data-v="${v}" class="${this.dview === v ? 'on' : ''}" ${v === 'day' ? '' : this.nw(v)}>${n}</button>`).join('')}</div>`;
    const go = (id: string, label: string) => { const why = canRun(id, s); return `<button class="lb-go dgo" data-id="${id}" ${why ? 'disabled' : ''}>${why ?? label}</button>`; };
    let body = '';
    if (this.dview === 'day') {
      const d = DUNGEONS.find(x => x.id === this.dsel)!;
      const best = s.dungeon!.best[d.id] ?? 0;
      const list = DUNGEONS.map(x => {
        const open = isOpen(x, wd);
        const left = DUNGEON_RUNS - (s.dungeon!.runs[x.id] ?? 0);
        return `<button class="dg ${x.id === this.dsel ? 'sel' : ''} ${open ? '' : 'shut'}" data-d="${x.id}"><b>${x.name}</b><small>${x.desc} · ${x.days.filter(n => n).map(n => DAY_NAMES[n]).join('·')}·일</small><em>${open ? `${left} / ${DUNGEON_RUNS}` : '닫힘'}</em></button>`;
      }).join('');
      const tiers = TIER_LEVEL.map((lv, i) => `<button class="dtier ${this.dtier === i + 1 ? 'on' : ''}" data-t="${i + 1}" ${i > best ? 'disabled' : ''}>${i + 1}<small>Lv.${lv}</small></button>`).join('');
      body = `<div class="dgs">${list}</div>
        <div class="dtiers">${tiers}</div>
        <div class="dinfo">${d.name} ${this.dtier}단계 · 적 Lv.${TIER_LEVEL[this.dtier - 1]} · 보상 ${rewardLine(d.reward(this.dtier))}</div>
        ${go(`d:${d.id}:${this.dtier}`, '출전')}`;
    } else if (this.dview === 'tower') {
      const t = s.tower!;
      const st = stageOf('tower', s)!;
      body = `<div class="dbig"><b>${t.floor}층</b><span>이번 주 기록 ${t.floor - 1}층 · 역대 최고 ${t.best}층</span></div>
        <div class="dinfo">적 Lv.${st.level} · 웨이브 ${st.waves.length}${st.waves.some(w => w.boss) ? ' · 보스' : ''}<br>보상 ${rewardLine(towerReward(t.floor))}${t.floor % 10 === 0 && t.floor >= 30 ? ' (불멸·초월 영웅)' : ''}</div>
        <div class="empty-note">층마다 적이 강해진다 · 10층마다 보스 · 30층부터 10층마다 불멸·초월 영웅 조각 · 월요일에 1층부터 다시</div>
        ${go('tower', `${t.floor}층 도전`)}`;
    } else if (this.dview === 'mock') {
      body = this.mockHtml(go);
    } else {
      const r = s.raid!;
      body = `<div class="dbig"><b>심연의 비룡 카르나스</b><span>${RAID_LIMIT}초 동안 준 피해로 보상 · 적 Lv.${RAID_LEVEL} · 하루 ${RAID_RUNS}회</span></div>
        <div class="rtiers">${RAID_TIERS.map((v, i) => `<div class="${r.best >= v ? 'on' : ''}"><b>${fmt(v)}</b><small>${rewardLine(raidReward(i + 1))}</small></div>`).join('')}</div>
        <div class="dinfo">이번 주 최고 ${fmt(r.best)} · 역대 ${fmt(r.top)} · 남은 횟수 ${RAID_RUNS - r.runs} / ${RAID_RUNS}</div>
        ${go('raid', '도전')}`;
    }
    return `<div class="lb-panel dun">${seg}${body}</div>`;
  }

  /** 모의전: 내 파티 B 또는 진영 AI 파티와 싸워 본다 (보상 없음) */
  private mockHtml(go: (id: string, label: string) => string) {
    const s = this.save;
    const mine = s.party.reduce((a, id) => a + loadout(s, id).power, 0);
    const teams: ['b' | FactionId, string, string[]][] = [['b', '내 파티 B', s.party2 ?? []], ...FACTION_IDS.map(f => [f, `${FACTIONS[f].name} 파티`, membersOf(f)] as ['b' | FactionId, string, string[]])];
    const name = (id: string) => HEROES.find(h => h.id === id)!.name;
    const list = teams.map(([t, n, ids]) => `<button class="dg mk ${t === this.mockTeam ? 'sel' : ''}" data-t="${t}"><b>${n}</b><small>${ids.length ? ids.map(name).join(' · ') : '비어 있음 · 눌러서 짠다'}</small><em>${t === 'b' ? '내 영웅' : 'AI'}</em></button>`).join('');
    const rivals = rivalParty(s, this.mockTeam, this.mockOff);
    const theirs = rivals.reduce((a, r) => a + r.power, 0);
    let mid: string;
    if (this.mockTeam === 'b') {
      const p2 = s.party2 ?? [];
      mid = this.forming2
        ? `<div class="froster">${this.owned().map(d => {
            const k = p2.indexOf(d.id);
            return `<button class="fr fr2 ${k >= 0 ? 'in' : ''}" data-id="${d.id}" style="--gc:${GRADE_COLORS[s.heroes[d.id].grade]}">${this.face(d.id)}${k >= 0 ? `<em>${k + 1}</em>` : ''}${this.facTag(d.id)}<span>${d.name}</span><small>Lv.${s.heroes[d.id].level}</small></button>`;
          }).join('')}</div>${this.synHtml(p2)}<button class="lb-go form2-t">완료</button>`
        : `${this.synHtml(p2)}<div class="dinfo">파티 B 는 내 영웅으로 짠다 (지금 파티와 겹쳐도 된다) · 장비·특성·행동 방침이 그대로 · 상대 전투력 ${fmt(theirs)} · 내 파티 ${fmt(mine)}</div><div class="go-row"><button class="form2-t">파티 B 편성</button>${go('mock:b:0', '대전')}</div>`;
    } else {
      const lv = rivals[0]?.level ?? 1;
      mid = `${this.synHtml(rivals.map(r => r.def.id))}
        <div class="moffs"><button class="moff" data-d="-1">−</button><span>상대 Lv.${lv} · ${GRADES[rivals[0]?.grade ?? 0]}까지<small>내 파티 평균 ${this.mockOff >= 0 ? '+' : ''}${this.mockOff}</small></span><button class="moff" data-d="1">+</button></div>
        <div class="dinfo">장비·특성 없는 AI 파티 · 상대 전투력 ${fmt(theirs)} · 내 파티 ${fmt(mine)}</div>
        ${go(`mock:${this.mockTeam}:${this.mockOff}`, '대전')}`;
    }
    return `<div class="dgs">${list}</div>${mid}<div class="empty-note">보상 없음 · 조합·행동 방침·진영 시너지를 시험해 보는 곳</div>`;
  }

  /** 임무 화면: 출석 7일, 일일 3개 + 보너스, 주간 */
  private missionsHtml() {
    const s = this.save;
    const { day } = refresh(s);
    const can = claimable(s);
    const d = s.daily!, w = s.weekly!, a = s.attend!;
    const got = a.last === day ? ((a.n - 1) % ATTEND.length) + 1 : a.n % ATTEND.length;   // 이번 7일 중 받은 날 수
    const btn = (k: string, done: boolean) => (done ? '<b class="ms-done">완료</b>' : `<button class="ms-go" data-k="${k}" ${can.includes(k) ? '' : 'disabled'}>받기</button>`);
    const row = (text: string, cur: number, n: number, rw: string, k: string, done: boolean) => `
      <div class="ms-row ${done ? 'done' : ''}"><span><b>${text}</b><small>${rw}</small></span><em>${cur} / ${n}</em>${btn(k, done)}</div>`;
    const daily = dailyOf(day);
    return `
      <div class="lb-panel ms">
        <div class="lb-ch">출석<span class="pp">누적 ${a.n}일</span></div>
        <div class="att">${ATTEND.map((rw, i) => {
          const k = i < got ? 'got' : i === got && can.includes('a') ? 'now' : '';
          return k === 'now' ? `<button class="att-d now ms-go" data-k="a"><b>${i + 1}일</b><small>${rewardText(rw)}</small></button>` : `<div class="att-d ${k}"><b>${i + 1}일</b><small>${rewardText(rw)}</small></div>`;
        }).join('')}</div>
        <div class="ms-list">
          <div class="ms-h">일일 임무<small>매일 0시에 바뀐다</small></div>
          ${daily.map((m, i) => row(missionText(m), progress(d.counts, m), m.n, rewardText(m.reward), `d${i}`, d.claimed.includes(i))).join('')}
          ${row('일일 임무 3개 완료', d.claimed.length, 3, rewardText(DAILY_BONUS), 'db', d.bonus)}
          <div class="ms-h">주간 임무<small>월요일에 바뀐다</small></div>
          ${WEEKLY.map((m, i) => row(missionText(m), progress(w.counts, m), m.n, rewardText(m.reward), `w${i}`, w.claimed.includes(i))).join('')}
        </div>
        <button class="lb-go ms-t">닫기</button>
      </div>`;
  }

  private claimMission(k: string) {
    const rw = claim(this.save, k);
    if (!rw) return;
    sound.play('coin');
    writeSave(this.save);
    this.render();
    const pop = document.createElement('div');
    pop.className = 'lvpop';
    pop.textContent = `+ ${rewardText(rw)}`;
    pop.addEventListener('animationend', () => pop.remove());
    this.el.append(pop);
  }

  private face(id: string) {
    return `<img src="${this.portraits[id] ?? portraitUrl(id)}" alt="">`;
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
          return `<button class="fr ${k >= 0 ? 'in' : ''}" data-id="${d.id}" style="--gc:${GRADE_COLORS[h.grade]}">${this.face(d.id)}${k >= 0 ? `<em>${k + 1}</em>` : ''}${this.facTag(d.id)}<span>${d.name}</span><small>Lv.${h.level}</small></button>`;
        }).join('')}</div>
        ${this.synHtml(s.party)}
        <div class="empty-note">누르면 넣고 뺀다 · 넣은 순서대로 앞줄 왼쪽부터 선다 · 1 ~ 4명 · 전투 중 ⇅ 로 앞뒷줄을 바꾼다</div>
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
    const MAXL = maxLevel(grade, s.heroes[d.id].stars);
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
    // 등급 보상: 패시브 (못 연 것은 흐리게), 필살기 단계, 파티 오라
    const passives = passivesOf(d.id).filter(p => p.at <= max).map(p => `<li class="passive ${grade >= p.at ? '' : 'off'}"><b>${p.name}</b><small>${grade >= p.at ? '패시브' : `${GRADES[p.at]}에 열림`}</small><p>${passiveText(p)}</p></li>`).join('');
    const ul = ultLevel(grade);
    const aura = auraOf(grade);
    const ultNote = `${ul > 1 ? ` · 필살기 Lv.${ul} (피해·치유 ×${ULT_MUL[ul - 1]})` : ''}${aura ? ` · 파티 오라: 아군 공격력 +${Math.round(aura * 100)}%` : ''}`;
    return `
      <div class="lb-panel hero" style="--accent:${d.color}">
        <div class="chips">${this.owned().map(x => `
          <button class="chip ${x.id === this.heroId ? 'on' : ''} ${s.party.includes(x.id) ? 'party' : ''}" data-id="${x.id}" style="--accent:${x.color}">${this.face(x.id)}<span>Lv.${s.heroes[x.id].level}</span>${this.heroDot(x.id) ? '<i class="dot"></i>' : ''}</button>`).join('')}
        </div>
        <div class="hd-head">
          <div><div class="hd-title" style="color:${GRADE_COLORS[grade]}">${GRADES[grade]} · ${d.titles?.[grade] ?? ''}</div><div class="hd-name">${d.name}${this.facTag(d.id)}<span>Lv.${lv}<small>/${MAXL}</small></span></div></div>
          <div class="hd-power"><small>전투력</small><b>${fmt(lo.power)}</b></div>
        </div>
        <div class="ladder">${ladder}</div>
        ${shown !== grade ? `<div class="ladder-note">${GRADES[shown]} 「${d.titles?.[shown] ?? ''}」 외형 미리보기 · ${shown > grade ? '같은 영웅 조각으로 승격하면 이 모습이 된다' : '지나온 모습'}</div>` : `<div class="ladder-note">최대 ${GRADES[max]}까지 성장 · 칭호를 누르면 그 등급 외형을 미리 본다</div>`}
        ${this.heroView === 'look' || !this.has('promo') ? '' : `<div class="promo-wrap" ${this.nw('promo')}>${this.promoHtml(d.id)}</div>`}
        <div class="seg"><button data-v="info" class="${this.heroView === 'info' ? 'on' : ''}">능력치</button>${this.has('talent') ? `<button data-v="talent" class="${this.heroView === 'talent' ? 'on' : ''}" ${this.nw('talent')}>특성${pointsOf(s.heroes[d.id]) > spentOf(s.heroes[d.id]) ? '<i class="dot"></i>' : ''}</button>` : ''}${this.has('gear') ? `<button data-v="gear" class="${this.heroView === 'gear' ? 'on' : ''}" ${this.nw('gear')}>장비${fillableSlot(s, d.id) ? '<i class="dot"></i>' : ''}</button>` : ''}<button data-v="look" class="${this.heroView === 'look' ? 'on' : ''}">외형</button></div>
        ${this.heroView === 'look' ? '' : this.heroView === 'gear' ? this.gearHtml(d.id) : this.heroView === 'talent' ? this.talentHtml(d.id) : `
        <div class="hd-stats">
          <div><small>체력</small><b>${fmt((st.hp * m + bn.hp) * (1 + bn.hpPct))}</b>${grow(st.hp)}</div>
          <div><small>공격력</small><b>${fmt((st.atk * m + bn.atk) * (1 + bn.atkPct))}</b>${grow(st.atk)}</div>
          <div><small>방어력</small><b>${fmt((st.def * m + bn.def) * (1 + bn.defPct))}</b>${grow(st.def)}</div>
          <div><small>공격 속도</small><b>${fmt(st.spd + bn.spd)}</b></div>
          <div><small>치명타</small><b>${((st.crit + bn.crit) * 100).toFixed(1)}%</b></div>
          <div><small>치명 피해</small><b>${Math.round((st.critDmg + bn.critDmg) * 100)}%</b></div>
        </div>
        <ul class="hd-skills">
          ${d.ult ? `<li class="ult"><b>${d.ult.name}</b><small>필살기${ul > 1 ? ` Lv.${ul}` : ''}</small><p>${d.ult.desc}${ultNote}</p></li>` : ''}${skills}${passives}
        </ul>
        ${this.has('policy') ? `<div class="pol" ${this.nw('policy')}><small>행동 방침</small>${POLICIES.map(p => `<button class="pl ${(s.policy?.[d.id] ?? 'attack') === p.id ? 'on' : ''}" data-p="${p.id}">${p.name}</button>`).join('')}</div>
        <div class="pol-d">${POLICIES.find(p => p.id === (s.policy?.[d.id] ?? 'attack'))!.desc}</div>` : ''}
        <div class="hd-lv">${btn(1)}${btn(5)}</div>`}
      </div>`;
  }

  /** 등급 승격 줄: 조각·골드와 다음 칭호 */
  private promoHtml(id: string) {
    const s = this.save;
    const d = HEROES.find(h => h.id === id)!;
    const g = s.heroes[id].grade;
    const have = s.shards?.[id] ?? 0;
    const st = s.heroes[id].stars ?? 0;
    // 별: 등급과 따로 0~5. 별마다 최대 레벨 +5, 특성 포인트 +1
    const stars = `<div class="stars"><span class="st">${'★'.repeat(st)}<i>${'★'.repeat(MAX_STARS - st)}</i></span>${st < MAX_STARS
      ? `<button class="star-go" ${canStar(s, id) ? 'disabled' : ''}><b>별 +1</b><small>조각 ${STAR_COST[st][0]} · <i class="ic-gold"></i>${fmt(STAR_COST[st][1])}</small></button>`
      : '<small>별 최대</small>'}<small class="st-note">별마다 Lv +5 · 특성 +1</small></div>`;
    if (g >= (d.maxGrade ?? 2)) return `<div class="promo max"><span>조각 <b>${fmt(have)}</b></span><span>최대 등급</span></div>${stars}`;
    const [need, gold] = PROMOTE[g];
    const why = canPromote(s, id);
    return `<div class="promo" style="--gc:${GRADE_COLORS[g + 1]}">
      <span class="pbar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i><b>조각 ${fmt(have)} / ${need}</b></span>
      <button class="promo-go" ${why ? 'disabled' : ''}><b>승격</b><small>${GRADES[g + 1]} · ${d.titles?.[g + 1] ?? ''}</small><span><i class="ic-gold"></i>${fmt(gold)}${PROMOTE_STONE[g] ? ` · 승격석 ${s.mats?.promo ?? 0}/${PROMOTE_STONE[g]}` : ''}</span></button>
    </div>${stars}`;
  }

  /** 특성: 가지 3개를 나란히, 노드를 누르면 아래에 설명과 배우기 */
  private talentHtml(id: string) {
    const s = this.save;
    const h = s.heroes[id];
    const r: number[] = h.talents ?? new Array(15).fill(0);
    const left = pointsOf(h) - spentOf(h);
    const sel = this.talentSel;
    const cols = branchesOf(id).map((br, b) => {
      const spent = r.slice(b * 5, b * 5 + 5).reduce((a, x) => a + x, 0);
      const nodes = [...br.nodes.map(nd => nd.name), br.cap.name].map((name, i) => {
        const rank = r[b * 5 + i], max = i === 4 ? 1 : RANKS;
        const locked = spent < NODE_NEED[i];
        return `<button class="tn ${i === 4 ? 'cap' : ''} ${rank ? 'got' : ''} ${rank >= max ? 'full' : ''} ${locked ? 'locked' : ''} ${sel?.[0] === b && sel[1] === i ? 'on' : ''}" data-b="${b}" data-i="${i}">
          <span>${name}</span><small>${i === 4 ? (rank ? '배움' : `${NODE_NEED[4]}P`) : `${rank}/${max}`}</small></button>`;
      }).join('');
      return `<div class="tb ${b === 0 ? 'main' : ''}"><div class="tb-h"><b>${br.name}</b><small>${br.desc}</small><em>${spent}</em></div>${nodes}</div>`;
    }).join('');
    let detail = '<div class="tn-info muted">노드를 눌러 효과를 본다 · 아래 노드는 같은 가지에 포인트를 먼저 써야 열린다</div>';
    if (sel) {
      const br = branchesOf(id)[sel[0]];
      const rank = r[sel[0] * 5 + sel[1]];
      const why = canLearn(s, id, sel[0], sel[1]);
      const text = sel[1] === 4 ? br.cap.desc : `단계마다 ${nodeText(br.nodes[sel[1]])}${rank ? ` · 지금 ${nodeText(br.nodes[sel[1]], rank)}` : ''}`;
      detail = `<div class="tn-info"><div><b>${sel[1] === 4 ? br.cap.name : br.nodes[sel[1]].name}</b><p>${text}</p></div>
        <button class="tn-go" ${why ? 'disabled' : ''}>${why ?? '배우기'}</button></div>`;
    }
    const spent = spentOf(h);
    return `<div class="talent">
      <div class="tn-top"><span>특성 포인트 <b>${left}</b> / ${pointsOf(h)}</span>
        <button class="tn-reset" ${spent && s.gold >= spent * RESET_GOLD ? '' : 'disabled'}>초기화 <i class="ic-gold"></i>${fmt(spent * RESET_GOLD)}</button></div>
      <div class="tree">${cols}</div>
      ${detail}
    </div>`;
  }

  /** 특성·별이 바뀌면 로비에 선 영웅의 능력치도 다시 (전투력 표시는 render 가 loadout 으로 다시 잰다) */
  private refreshBonus() {
    const u = this.cur();
    u.bonus = loadout(this.save, u.def.id).bonus;
  }

  private learnTalent() {
    const sel = this.talentSel;
    if (!sel || !learn(this.save, this.heroId, sel[0], sel[1])) return;
    sound.play('up');
    track(this.save, 'talent');
    writeSave(this.save);
    this.refreshBonus();
    const u = this.cur();
    this.fx.ring(u.pos, COL.blue, 1.8, 0.5);
    this.render();
  }

  private starHero() {
    const s = this.save;
    const u = this.cur();
    if (!starUp(s, u.def.id)) return;
    sound.play('rare');
    track(s, 'promote');
    writeSave(s);
    this.refreshBonus();
    this.fx.ring(u.pos, COL.gold, 2.4, 0.6);
    this.fx.burst(u.chest(), COL.gold, 40, 5, 0.25);
    u.play(u.def.anims.victory ?? u.def.anims.idle, false);
    u.curAnim?.onAnimationGroupEndObservable.addOnce(() => u.play(u.def.anims.idle));
    this.render();
    const pop = document.createElement('div');
    pop.className = 'lvpop';
    pop.textContent = `★ ${s.heroes[u.def.id].stars}`;
    pop.addEventListener('animationend', () => pop.remove());
    this.el.append(pop);
  }

  private async promoteHero() {
    const s = this.save;
    const d = this.cur().def;
    const from = s.heroes[d.id].grade;
    if (!promote(s, d.id)) return;
    sound.play('rare');
    track(s, 'promote');
    writeSave(s);
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
    track(this.save, this.banner === 'hero' || this.banner === 'pickup' ? 'summon' : 'gear', n);
    writeSave(this.save);
    this.render();
    const bn = BANNERS.find(b => b.id === this.banner)!;
    const c = n === 10 ? bn.cost10 : bn.cost;
    showSummon(pulls, this.portraits, hiFrom(this.banner), { label: `한 번 더 · ${fmt(c)}`, ok: this.save.gems >= c }, () => this.pull(n), () => this.render());
  }

  /** 일괄 분해 대상: 끼지 않고 강화하지 않은 일반·고급 */
  private lowItems() {
    return (this.save.items ?? []).filter(i => i.grade <= 1 && !i.lv && !wearerOf(this.save, i.uid)).map(i => i.uid);
  }

  private salvage(uids: number[]) {
    const r = salvage(this.save, uids);
    if (!r.n) return;
    sound.play('coin');
    track(this.save, 'salvage', r.n);
    writeSave(this.save);
    this.bagSel = null;
    this.render();
    const pop = document.createElement('div');
    pop.className = 'lvpop';
    pop.textContent = `분해 ${r.n}개  +${fmt(r.gold)} 골드 · 강화석 ${r.stone}${r.essence ? ` · 정수 ${r.essence}` : ''}`;
    pop.addEventListener('animationend', () => pop.remove());
    this.el.append(pop);
  }

  private enhanceItem(uid: number) {
    if (!enhance(this.save, uid)) return;
    sound.play('up');
    // 낀 영웅이 지금 서 있으면 능력치를 다시 잰다
    const w = wearerOf(this.save, uid);
    const u = w ? this.unitOf(w) : null;
    if (u) u.bonus = loadout(this.save, w!).bonus;
    this.render();
    const it = this.save.items!.find(i => i.uid === uid)!;
    const pop = document.createElement('div');
    pop.className = 'lvpop';
    pop.textContent = `강화 +${it.lv}${it.uq && (it.lv === 10 || it.lv === 15) ? '  고유 효과 강화' : ''}`;
    pop.addEventListener('animationend', () => pop.remove());
    this.el.append(pop);
  }

  private craftItem(uq: string) {
    const it = craft(this.save, uq);
    if (!it) return;
    sound.play('rare');
    this.crafting = false;
    this.bagFilter = 'all';
    this.bagSel = it.uid;
    this.render();
    const pop = document.createElement('div');
    pop.className = 'lvpop';
    pop.textContent = `제작 · ${UNIQUES[uq].name}`;
    pop.addEventListener('animationend', () => pop.remove());
    this.el.append(pop);
  }

  /** 아이템 한 줄 (아이콘, 등급, 이름, 주옵션) */
  private itemRow(it: Item, extra = '') {
    const b = baseOf(it);
    return `<i class="ico" style="--ico:url(${ITEM_ICON(it)});--gc:${GRADE_COLORS[it.grade]}"></i>
      <span class="inm"><small style="color:${GRADE_COLORS[it.grade]}">${GRADES[it.grade]}${it.set ? ` · ${SETS[it.set].name}` : ''}${it.uq ? ` · ${UNIQUES[it.uq].name}` : ''}</small>${it.lv ? `+${it.lv} ` : ''}${b.name}${extra}</span>
      <span class="ist">${STAT_NAMES[it.main[0]]} ${fmtStat(...statsOf(it).main)}${it.subs.length ? ` <em>+${it.subs.length}</em>` : ''}</span>`;
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
    // 낀 세트와 고유 효과 요약
    const worn = equippedItems(s, heroId);
    const sets = Object.entries(setCounts(worn)).map(([id, n]) => `<span class="${n >= 2 ? 'on' : ''}"><b>${SETS[id].name} ${n}/4</b> ${n >= 4 ? SETS[id].fourText : SETS[id].twoText}</span>`);
    const uqs = worn.filter(i => i.uq).map(i => `<span class="on"><b>${UNIQUES[i.uq!].name}</b> ${UNIQUES[i.uq!].desc(uqPower(i.lv))}</span>`);
    const sum = sets.length || uqs.length ? `<div class="gsum">${[...uqs, ...sets].join('')}</div>` : '';
    return `<div class="eslots">${slots}</div>${sum}${list || '<div class="empty-note">칸을 누르면 가방에서 낄 장비를 고른다 · 무기·방패·투구·갑옷·망토는 모습에 바로 보인다</div>'}`;
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
      const st = statsOf(sel);
      const uq = sel.uq ? UNIQUES[sel.uq] : null;
      const set = sel.set ? SETS[sel.set] : null;
      const lv = sel.lv ?? 0;
      const c = enhanceCost(sel), sv = salvageOf(sel);
      return `<div class="idetail" style="--gc:${GRADE_COLORS[sel.grade]}">
        <i class="ico big" style="--ico:url(${ITEM_ICON(sel)})"></i>
        <div><div class="idn"><small>${GRADES[sel.grade]} · ${SLOT_NAMES[(b.slot === 'acc' ? 'acc1' : b.slot) as EquipSlot]}${b.hands === 2 ? ' · 양손' : ''}</small>${lv ? `+${lv} ` : ''}${b.name}</div>
        <div class="ids"><b>${STAT_NAMES[st.main[0]]} ${fmtStat(...st.main)}</b>${st.subs.map(([k, v]) => `<span>${STAT_NAMES[k]} +${fmtStat(k, v)}</span>`).join('')}</div>
        ${uq ? `<div class="iuq"><b>고유 · ${uq.name}</b> ${uq.desc(uqPower(lv))}<span class="${sel.grade >= 5 ? '' : 'off'}">${sel.grade >= 5 ? '' : '신화 이상: '}${uq.desc2}</span>${sel.grade >= 6 && uq.party ? '<span>파티 전체에 절반 세기로 걸린다</span>' : ''}<small>+10, +15 에서 강해진다</small></div>` : ''}
        ${set ? `<div class="iset"><b>세트 · ${set.name}</b><span>2개: ${set.twoText}</span><span>4개: ${set.fourText}</span></div>` : ''}
        <div class="idw">${w ? `${HEROES.find(h => h.id === w)!.name} 착용 중` : '착용 안 함'}</div></div>
        <div class="ibtns">
          ${!this.has('enhance') ? '' : lv < MAX_ENHANCE ? `<button class="enh" data-uid="${sel.uid}" ${canEnhance(s, sel) ? '' : 'disabled'} ${this.nw('enhance')}>강화 +${lv + 1}<span><i class="ic-gold"></i>${fmt(c.gold)} · 강화석 ${c.stone}</span></button>` : '<b class="enh-max">강화 최대</b>'}
          ${w ? '' : `<button class="salv one" data-uid="${sel.uid}">분해<span><i class="ic-gold"></i>${fmt(sv.gold)} · 강화석 ${sv.stone}${sv.essence ? ` · 정수 ${sv.essence}` : ''}</span></button>`}
        </div>
      </div>`;
    })() : '<div class="empty-note">장비를 누르면 자세히 본다 · 장착은 영웅 탭 → 장비에서</div>';
    const m = s.mats ?? { stone: 0, essence: 0 };
    const matRow = `<div class="mats"><span>강화석 <b>${fmt(m.stone)}</b></span><span>정수 <b>${fmt(m.essence)}</b></span><span>승격석 <b>${fmt(m.promo ?? 0)}</b></span>${this.has('craft') ? `<button class="craft-t ${this.crafting ? 'on' : ''}" ${this.nw('craft')}>${this.crafting ? '가방으로' : '제작'}</button>` : ''}</div>`;
    if (this.crafting) return `
      <div class="lb-panel bag">
        <div class="lb-ch">제작<span class="pp">전설 장비 · 고유 효과를 골라 확정</span></div>
        ${matRow}
        <div class="crafts">${UNIQUE_IDS.map(id => {
          const u = UNIQUES[id];
          return `<div class="crow"><span><b>${u.name}</b><small>${SLOT_NAMES[(u.slot === 'acc' ? 'acc1' : u.slot) as EquipSlot]}</small><p>${u.desc(1)}</p></span><button class="craft-go" data-u="${id}" ${canCraft(s) ? '' : 'disabled'}>제작<small>정수 ${CRAFT.essence} · ${fmt(CRAFT.gold)}</small></button></div>`;
        }).join('')}</div>
      </div>`;
    return `
      <div class="lb-panel bag">
        <div class="lb-ch">가방<span class="pp">장비 <b>${s.items?.length ?? 0}</b><button class="salv all" ${this.lowItems().length ? '' : 'disabled'}>일반·고급 분해 ${this.lowItems().length}</button></span></div>
        ${matRow}
        <div class="flts">${F.map(([k, n]) => `<button class="flt ${this.bagFilter === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
        ${detail}
        <div class="tiles">${items.map(i => `<button class="tile ${i.uid === this.bagSel ? 'on' : ''} ${wearerOf(s, i.uid) ? 'worn' : ''}" data-uid="${i.uid}" style="--gc:${GRADE_COLORS[i.grade]}"><i class="ico" style="--ico:url(${ITEM_ICON(i)})"></i>${i.lv ? `<b class="plv">+${i.lv}</b>` : ''}${i.uq ? '<b class="puq">★</b>' : ''}</button>`).join('') || '<div class="empty-note">비어 있다</div>'}</div>
      </div>`;
  }

  private levelUp(n: number) {
    const s = this.save;
    const u = this.cur();
    const h = s.heroes[u.def.id];
    let done = 0;
    while (done < n && h.level < maxLevel(h.grade, h.stars) && s.gold >= levelCost(h.level)) {
      s.gold -= levelCost(h.level);
      h.level++;
      done++;
    }
    if (!done) return;
    track(s, 'levelup', done);
    sound.play('up');
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
