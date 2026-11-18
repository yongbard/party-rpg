// 일일·주간 임무와 출석 (design.md 5·6장). 날짜는 기기 시각 기준, 주는 월요일에 바뀐다
import { rollItem } from './items';
import { addItem, type SaveData } from './save';

/** 임무가 세는 일 */
export type Ev = 'win' | 'boss' | 'star' | 'summon' | 'gear' | 'levelup' | 'talent' | 'salvage' | 'promote';
export interface Reward { gold?: number; gems?: number; item?: number }   // item = 장비 등급
export interface Mission { ev: Ev; n: number; reward: Reward }

const EV_TEXT: Record<Ev, string> = {
  win: '전투 {n}번 승리', boss: '보스 스테이지 {n}번 승리', star: '스테이지 별 {n}개 얻기',
  summon: '영웅 소환 {n}번', gear: '장비·무기 소환 {n}번', levelup: '영웅 레벨 {n}번 올리기',
  talent: '특성 {n}번 배우기', salvage: '장비 {n}개 분해', promote: '등급 승격·별 승급 {n}번',
};
export const missionText = (m: Mission) => EV_TEXT[m.ev].replace('{n}', String(m.n));

/** 일일 임무 후보. 날마다 3개를 고른다 */
const DAILY_POOL: Mission[] = [
  { ev: 'win', n: 3, reward: { gems: 20, gold: 2000 } },
  { ev: 'win', n: 6, reward: { gems: 30, gold: 3000 } },
  { ev: 'boss', n: 1, reward: { gems: 30 } },
  { ev: 'summon', n: 1, reward: { gems: 20 } },
  { ev: 'gear', n: 1, reward: { gems: 20, gold: 2000 } },
  { ev: 'levelup', n: 5, reward: { gems: 20, gold: 2000 } },
  { ev: 'talent', n: 1, reward: { gems: 20 } },
  { ev: 'salvage', n: 3, reward: { gems: 20, gold: 1000 } },
];
/** 일일 임무 3개를 다 받으면 더 주는 것. 보석 수입 기준(design.md 5장, 주 약 1,500): 일일 약 105 × 7 + 출석 280 + 주간 560 */
export const DAILY_BONUS: Reward = { gems: 30, gold: 3000 };
export const WEEKLY: Mission[] = [
  { ev: 'win', n: 30, reward: { gems: 100, gold: 10000 } },
  { ev: 'boss', n: 5, reward: { gems: 100 } },
  { ev: 'star', n: 9, reward: { gems: 100 } },
  { ev: 'summon', n: 20, reward: { gems: 100 } },
  { ev: 'levelup', n: 30, reward: { gems: 80, gold: 15000 } },
  { ev: 'promote', n: 1, reward: { gems: 80, item: 4 } },
];
/** 출석 7일 (다 받으면 1일째로 돌아간다). 하루를 걸러도 이어서 센다 */
export const ATTEND: Reward[] = [
  { gold: 3000 }, { gems: 50 }, { gold: 6000 }, { item: 3 }, { gems: 80 }, { gold: 12000 }, { gems: 150, item: 4 },
];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 그 주 월요일 날짜 */
const weekKey = (d: Date) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));

/** 날짜로 정하는 일일 임무 3개 (같은 날이면 늘 같다) */
export function dailyOf(day: string) {
  let seed = [...day].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);   // FNV-1a
  const rnd = () => {   // mulberry32
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...DAILY_POOL];
  const out: Mission[] = [];
  while (out.length < 3) {
    const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if (!out.some(o => o.ev === m.ev)) out.push(m);   // 같은 종류는 하나만
  }
  return out;
}

/** 날이나 주가 바뀌었으면 세던 것을 새로 시작한다 */
export function refresh(s: SaveData, now = new Date()) {
  const day = dayKey(now), week = weekKey(now);
  if (s.daily?.day !== day) s.daily = { day, counts: {}, claimed: [], bonus: false };
  if (s.weekly?.week !== week) s.weekly = { week, counts: {}, claimed: [] };
  s.attend ??= { last: '', n: 0 };
  return { day, week };
}

/** 일이 일어났을 때 부른다 (일일·주간 둘 다 센다) */
export function track(s: SaveData, ev: Ev, n = 1) {
  refresh(s);
  for (const c of [s.daily!.counts, s.weekly!.counts]) c[ev] = (c[ev] ?? 0) + n;
}

export function give(s: SaveData, r: Reward) {
  s.gold += r.gold ?? 0;
  s.gems += r.gems ?? 0;
  if (r.item != null) addItem(s, rollItem(0, r.item));
}
export const rewardText = (r: Reward) =>
  [r.gems && `보석 ${r.gems}`, r.gold && `골드 ${r.gold.toLocaleString()}`, r.item != null && '장비 1'].filter(Boolean).join(' · ');

export const progress = (counts: Record<string, number>, m: Mission) => Math.min(m.n, counts[m.ev] ?? 0);

/** 받을 수 있는 것: 'd0'~'d2' 일일, 'db' 일일 보너스, 'w0'~ 주간, 'a' 출석 */
export function claimable(s: SaveData) {
  const { day } = refresh(s);
  const out: string[] = [];
  const d = s.daily!, w = s.weekly!;
  dailyOf(day).forEach((m, i) => { if (!d.claimed.includes(i) && progress(d.counts, m) >= m.n) out.push(`d${i}`); });
  if (!d.bonus && d.claimed.length >= 3) out.push('db');
  WEEKLY.forEach((m, i) => { if (!w.claimed.includes(i) && progress(w.counts, m) >= m.n) out.push(`w${i}`); });
  if (s.attend!.last !== day) out.push('a');
  return out;
}

/** 하나 받는다. 받은 보상을 돌려준다 */
export function claim(s: SaveData, key: string): Reward | null {
  if (!claimable(s).includes(key)) return null;
  const { day } = refresh(s);
  let r: Reward;
  if (key === 'a') {
    r = ATTEND[s.attend!.n % ATTEND.length];
    s.attend = { last: day, n: s.attend!.n + 1 };
  } else if (key === 'db') {
    r = DAILY_BONUS;
    s.daily!.bonus = true;
  } else {
    const i = Number(key.slice(1));
    if (key[0] === 'd') { r = dailyOf(day)[i].reward; s.daily!.claimed.push(i); }
    else { r = WEEKLY[i].reward; s.weekly!.claimed.push(i); }
  }
  give(s, r);
  return r;
}
