// 반복 콘텐츠: 요일 던전, 무한탑, 레이드 (design.md 6장). 스테이지 id: 'd:{던전}:{단계}', 'tower', 'raid'
import { HEROES, STAGES, WAVE_POOL, type Stage, type Wave } from './data';
import { dayKey, weekKey } from './missions';
import type { SaveData } from './save';
import { FACTIONS, type FactionId } from './tactics';

export interface ModeReward { gold?: number; gems?: number; stone?: number; essence?: number; promo?: number; shards?: number }

// ───────── 요일 던전 ─────────

export type DungeonId = 'gold' | 'stone' | 'essence' | 'promo' | 'shard';
const U = WAVE_POOL.undead, G = WAVE_POOL.goblin;
export interface Dungeon { id: DungeonId; name: string; desc: string; days: number[]; waves: Wave[]; reward: (t: number) => ModeReward }
/** days: 여는 요일 (0 = 일요일, 일요일은 모두 연다) */
export const DUNGEONS: Dungeon[] = [
  { id: 'gold', name: '황금 금고', desc: '골드', days: [1, 4, 0], waves: [G[1], G[2]], reward: t => ({ gold: 5000 * t }) },
  { id: 'stone', name: '무쇠 광산', desc: '강화석', days: [2, 5, 0], waves: [G[4], G[5]], reward: t => ({ stone: 10 * t, gold: 500 * t }) },
  { id: 'essence', name: '마력의 샘', desc: '정수', days: [3, 6, 0], waves: [G[3], G[6]], reward: t => ({ essence: 4 * t, gold: 500 * t }) },
  { id: 'promo', name: '시련의 제단', desc: '승격석', days: [1, 3, 5, 0], waves: [U[4], U[5]], reward: t => ({ promo: 2 * t, gold: 500 * t }) },
  { id: 'shard', name: '영웅의 무덤', desc: '영웅 조각', days: [2, 4, 6, 0], waves: [U[3], U[6]], reward: t => ({ shards: 4 * t, gold: 500 * t }) },
];
export const DUNGEON_RUNS = 3;                      // 던전마다 하루 3회
export const TIER_LEVEL = [4, 8, 12, 16, 20, 25];   // 단계별 적 레벨
export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// ───────── 무한탑 ─────────

/** 층마다 적 레벨 +1, 10층마다 보스. 주마다(월요일) 1층부터 다시 */
export function towerWaves(f: number): Wave[] {
  const pool = f % 2 ? U : G;
  const a = pool[(f * 3) % pool.length], b = pool[(f * 5 + 2) % pool.length];
  if (f % 10 === 0) return [a, WAVE_POOL.boss[(f / 10) % 2 ? 0 : 1]];
  return f < 5 ? [a] : [a, b];
}
export function towerReward(f: number): ModeReward {
  return { gold: 300 + 80 * f, stone: 2 + Math.floor(f / 4), gems: f % 10 === 0 ? 50 : 10, shards: f % 10 === 0 ? 8 : 0 };
}

// ───────── 레이드 ─────────

export const RAID_RUNS = 2;            // 하루 2회
export const RAID_LIMIT = 60;          // 초
export const RAID_LEVEL = 12;
/** 피해량 구간: 넘은 구간 수가 보상 단계 */
export const RAID_TIERS = [20000, 50000, 100000, 180000, 300000, 500000];
export const raidTier = (dmg: number) => RAID_TIERS.filter(t => dmg >= t).length;
export const raidReward = (k: number): ModeReward => ({ gold: 3000 * (k + 1), stone: 8 * (k + 1), essence: 2 * k, promo: k });

// ───────── 저장 ─────────

/** 날·주가 바뀌면 횟수를 새로 */
export function refreshModes(s: SaveData, now = new Date()) {
  const day = dayKey(now), week = weekKey(now);
  s.dungeon ??= { day, runs: {}, best: {} };
  if (s.dungeon.day !== day) s.dungeon = { day, runs: {}, best: s.dungeon.best };
  s.tower ??= { week, floor: 1, best: 0 };
  if (s.tower.week !== week) s.tower = { week, floor: 1, best: s.tower.best };
  s.raid ??= { day, runs: 0, week, best: 0, top: 0 };
  if (s.raid.day !== day) s.raid = { ...s.raid, day, runs: 0 };
  if (s.raid.week !== week) s.raid = { ...s.raid, week, best: 0 };
  return now.getDay();
}

export const isOpen = (d: Dungeon, weekday: number) => weekday === 0 || d.days.includes(weekday);

export function stageOf(id: string, s: SaveData): Stage | undefined {
  if (id.startsWith('d:')) {
    const [, did, t] = id.split(':');
    const d = DUNGEONS.find(x => x.id === did)!;
    const tier = Number(t);
    return { id, name: `${d.name} ${tier}단계`, level: TIER_LEVEL[tier - 1], waves: d.waves, reward: { gold: 0, gems: 0 }, conds: [] };
  }
  if (id === 'tower') {
    refreshModes(s);
    const f = s.tower!.floor;
    return { id, name: `무한탑 ${f}층`, level: 2 + f, waves: towerWaves(f), reward: { gold: 0, gems: 0 }, conds: [] };
  }
  // 모의전 'mock:{상대}:{레벨 차이}': 적 웨이브 없이 상대 파티가 선다 (main.ts 가 rivalParty 로 만든다)
  if (id.startsWith('mock:')) {
    const team = id.split(':')[1];
    return { id, name: `모의전 · ${team === 'b' ? '내 파티 B' : FACTIONS[team as FactionId].name}`, level: 1, waves: [{ units: [] }], reward: { gold: 0, gems: 0 }, conds: [] };
  }
  if (id === 'raid') return { id, name: '심연의 비룡', level: RAID_LEVEL, waves: [{ boss: true, units: [['wyrm', 0, 9]] }], reward: { gold: 0, gems: 0 }, conds: [], limit: RAID_LIMIT };
  return STAGES.find(st => st.id === id);
}

/** 지금 들어갈 수 있나. 안 되면 이유 */
export function canRun(id: string, s: SaveData): string | null {
  const wd = refreshModes(s);
  if (id.startsWith('d:')) {
    const [, did, t] = id.split(':');
    const d = DUNGEONS.find(x => x.id === did)!;
    if (!isOpen(d, wd)) return '오늘은 닫혀 있다';
    if ((s.dungeon!.runs[did] ?? 0) >= DUNGEON_RUNS) return '오늘 횟수를 다 썼다';
    if (Number(t) > (s.dungeon!.best[did] ?? 0) + 1) return '앞 단계를 먼저 깬다';
  }
  if (id === 'raid' && s.raid!.runs >= RAID_RUNS) return '오늘 횟수를 다 썼다';
  if (id.startsWith('mock:b') && !s.party2?.some(h => s.heroes[h])) return '파티 B 를 먼저 짠다';
  return null;
}

/** 영웅 조각을 줄 영웅: 가진 영웅 중 무작위 (무한탑 30층부터는 불멸·초월까지 오르는 영웅만) */
function shardHero(s: SaveData, high = false) {
  const own = HEROES.filter(h => s.heroes[h.id] && (!high || (h.maxGrade ?? 2) >= 6));
  const pool = own.length ? own : HEROES.filter(h => s.heroes[h.id]);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 전투가 끝난 뒤: 보상을 주고 결과 화면에 쓸 줄을 돌려준다 */
export function finishRun(s: SaveData, id: string, win: boolean, damage: number) {
  refreshModes(s);
  let r: ModeReward = {};
  const lines: string[] = [];
  const after: string[] = [];   // 보상 줄 다음에 쓸 것 (남은 횟수)
  let title: string | undefined;
  if (id.startsWith('d:')) {
    const [, did, t] = id.split(':');
    const tier = Number(t);
    if (!win) return null;   // 지면 횟수를 쓰지 않는다
    s.dungeon!.runs[did] = (s.dungeon!.runs[did] ?? 0) + 1;
    s.dungeon!.best[did] = Math.max(s.dungeon!.best[did] ?? 0, tier);
    r = DUNGEONS.find(x => x.id === did)!.reward(tier);
    after.push(`남은 횟수 ${DUNGEON_RUNS - s.dungeon!.runs[did]} / ${DUNGEON_RUNS}`);
  } else if (id === 'tower') {
    if (!win) return null;
    const f = s.tower!.floor;
    r = towerReward(f);
    s.tower!.floor = f + 1;
    s.tower!.best = Math.max(s.tower!.best, f);
    lines.push(`${f}층 돌파 · 다음 ${f + 1}층`);
    if (f >= 30 && f % 10 === 0) lines.push('고층 보상: 불멸·초월 영웅 조각');
  } else if (id.startsWith('mock:')) {
    // 모의전: 보상 없음
    title = win ? '모의전 승리' : '모의전 패배';
    lines.push('조합 실험용 · 보상 없음');
  } else if (id === 'raid') {
    s.raid!.runs++;
    s.raid!.best = Math.max(s.raid!.best, damage);
    s.raid!.top = Math.max(s.raid!.top, damage);
    const k = raidTier(damage);
    r = raidReward(k);
    title = '레이드 종료';
    lines.push(`피해량 ${Math.round(damage).toLocaleString()} · 보상 ${k}단계`);
    after.push(`남은 횟수 ${RAID_RUNS - s.raid!.runs} / ${RAID_RUNS}`);
  }
  s.gold += r.gold ?? 0;
  s.gems += r.gems ?? 0;
  const m = (s.mats ??= { stone: 0, essence: 0 });
  m.stone += r.stone ?? 0;
  m.essence += r.essence ?? 0;
  m.promo = (m.promo ?? 0) + (r.promo ?? 0);
  if (r.essence) lines.push(`정수 ${r.essence}`);
  if (r.promo) lines.push(`승격석 ${r.promo}`);
  if (r.shards) {
    const h = shardHero(s, id === 'tower' && s.tower!.floor - 1 >= 30);
    (s.shards ??= {})[h.id] = (s.shards[h.id] ?? 0) + r.shards;
    lines.push(`${h.name} 조각 ${r.shards}`);
  }
  return { gold: r.gold ?? 0, gems: r.gems ?? 0, stone: r.stone ?? 0, lines: [...lines, ...after], title };
}

/** 보상 미리보기 글 */
export const rewardLine = (r: ModeReward) => [
  r.gold && `골드 ${r.gold.toLocaleString()}`, r.gems && `보석 ${r.gems}`, r.stone && `강화석 ${r.stone}`,
  r.essence && `정수 ${r.essence}`, r.promo && `승격석 ${r.promo}`, r.shards && `영웅 조각 ${r.shards}`,
].filter(Boolean).join(' · ');
