// 기기 안 저장 (localStorage). 서버 없음.
import { HEROES } from './data';
import { rollItem, type EquipSlot, type Item } from './items';
import type { Policy } from './tactics';
import { opened } from './unlocks';

export interface SaveData {
  v: 1;
  gold: number;
  gems: number;
  heroes: Record<string, {
    level: number; grade: number; equip?: Partial<Record<EquipSlot, number>>;
    stars?: number;           // 별 0~5 (talents.ts)
    talents?: number[];       // 특성 단계 15칸: 가지 3 × 노드 5
  }>;   // 가진 영웅만
  shards?: Record<string, number>;                  // 영웅 조각 (중복 소환)
  pity?: { hero: number; hero5: number; gear: number; pick?: number };   // 천장 카운터 (전설+, 신화+, 장비 전설+, 픽업 영웅)
  items?: Item[];           // 가방
  mats?: { stone: number; essence: number; promo?: number };   // 강화석(강화), 정수(제작), 승격석(전설 이상 승격)
  dungeon?: { day: string; runs: Record<string, number>; best: Record<string, number> };   // 요일 던전: 오늘 횟수, 깬 최고 단계 (modes.ts)
  tower?: { week: string; floor: number; best: number };   // 무한탑: 이번 주 다음 층, 역대 최고 층
  raid?: { day: string; runs: number; week: string; best: number; top: number };   // 레이드: 오늘 횟수, 이번 주·역대 최고 피해
  nextUid?: number;
  party: string[];          // 진형 순서: 앞줄 왼쪽, 앞줄 오른쪽, 뒷줄 왼쪽, 뒷줄 오른쪽
  cleared: string[];        // 클리어한 스테이지 id
  stars?: Record<string, number>;   // 스테이지 별: 조건 3개를 비트로 (1 = 클리어, 2·4 = 조건 2·3)
  daily?: { day: string; counts: Record<string, number>; claimed: number[]; bonus: boolean };   // missions.ts
  weekly?: { week: string; counts: Record<string, number>; claimed: number[] };
  attend?: { last: string; n: number };   // 마지막 출석 날짜, 받은 횟수
  auto?: boolean;           // 필살기 자동 사용
  policy?: Record<string, Policy>;   // 영웅별 행동 방침 (tactics.ts), 없으면 공격 우선
  party2?: string[];        // 모의전 상대로 쓰는 내 파티 B
  opt?: { sfx: number; mus: number; speed: number };   // 설정: 효과음·음악 크기(0~1), 전투 배속
  tut?: string[];           // 예전 튜토리얼 안내 (빠짐, 하던 저장 호환으로 둔다)
  seen?: string[];          // 눌러 본 기능 (unlocks.ts). 새로 열린 것만 빛낸다
}

const KEY = 'party-rpg-save';
/** 처음부터 가진 영웅. 나머지는 소환으로 얻는다 */
const STARTERS = ['leon', 'bran', 'sera', 'kyle'];
const START_GEMS = 3000;   // 뽑기를 바로 해 볼 수 있게 (10연 2번)

/** 시작 장비: 낮은 등급 아이템 몇 개 (뽑기가 생기기 전까지 장비를 써 볼 수 있게) */
function giveStarter(s: SaveData) {
  s.items = [];
  s.nextUid = 1;
  const add = (grade: number, slot?: Parameters<typeof rollItem>[2]) => s.items!.push(rollItem(s.nextUid!++, grade, slot));
  (['weapon', 'weapon', 'weapon', 'offhand', 'helmet', 'cloak', 'armor', 'acc'] as const).forEach((slot, i) => add(i < 4 ? 0 : 1, slot));
}

export function addItem(s: SaveData, item: Omit<Item, 'uid'>) {
  s.nextUid ??= 1;
  const it = { ...item, uid: s.nextUid++ } as Item;
  (s.items ??= []).push(it);
  return it;
}

function fresh(): SaveData {
  return upgrade({
    v: 1,
    gold: 0,
    gems: 0,
    heroes: {},
    party: [...STARTERS],
    cleared: [],
  });
}

/** 예전 저장에 새 항목을 채운다 */
function upgrade(s: SaveData) {
  // 등급이 생기기 전 저장: 처음 등급으로 채운다
  for (const h of HEROES.filter(h => STARTERS.includes(h.id))) {
    s.heroes[h.id] ??= { level: 1, grade: h.startGrade ?? 2 };
    s.heroes[h.id].grade ??= h.startGrade ?? 2;
  }
  if (!s.items) giveStarter(s);
  // 장마다 스테이지가 3개였던 저장: 장 보스(N-3)를 깼으면 그 장 10개를 모두 깬 것으로 (별은 클리어 1개)
  if (!s.stars) {
    s.stars = {};
    const old = [...s.cleared];
    s.cleared = [];
    for (const id of old) {
      const [ch, k] = id.split('-').map(Number);
      const ids = k === 3 ? Array.from({ length: 10 }, (_, i) => `${ch}-${i + 1}`) : [id];
      for (const x of ids) if (!s.cleared.includes(x)) { s.cleared.push(x); s.stars[x] = 1; }
    }
  }
  // 튜토리얼이 생기기 전부터 하던 저장은 안내를 띄우지 않는다
  s.tut ??= s.cleared.length ? ['*'] : [];
  // 열림이 생기기 전부터 하던 저장: 지금 열린 것은 본 것으로 (빛이 쏟아지지 않게)
  s.seen ??= opened(s.cleared);
  if (!s.pity) {
    s.pity = { hero: 0, hero5: 0, gear: 0 };
    s.gems += START_GEMS;
  }
  return s;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as SaveData;
      if (s.v === 1) return upgrade(s);
    }
  } catch (e) {
    console.warn('저장 데이터를 읽지 못했습니다. 새로 시작합니다.', e);
  }
  return fresh();
}

/** 저장 코드: JSON 을 base64 로 (한글이 깨지지 않게 UTF-8 바이트로) */
export function exportCode(s: SaveData) {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

/** 파일(JSON) 이나 저장 코드를 읽는다. 잘못됐으면 이유 */
export function parseSave(text: string): SaveData | string {
  const t = text.trim();
  if (!t) return '내용이 비어 있다';
  let json = t;
  if (!t.startsWith('{')) {
    try { json = new TextDecoder().decode(Uint8Array.from(atob(t.replace(/\s+/g, '')), c => c.charCodeAt(0))); } catch { return '저장 코드가 아니다'; }
  }
  try {
    const s = JSON.parse(json) as SaveData;
    if (s.v !== 1 || typeof s.heroes !== 'object' || !Array.isArray(s.party) || !Array.isArray(s.cleared)) return '이 게임의 저장이 아니다';
    return upgrade(s);
  } catch {
    return '저장을 읽지 못했다';
  }
}

/** 가져온 저장으로 바꾼다 (다음에 다시 불러온다) */
export function storeSave(s: SaveData) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function resetSave() { localStorage.removeItem(KEY); }

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('저장 실패', e);
  }
}
